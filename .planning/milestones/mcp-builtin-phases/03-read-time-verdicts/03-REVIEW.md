---
phase: 03-read-time-verdicts
reviewed: 2026-11-04T20:10:48Z
depth: standard
iteration: 3
files_reviewed: 18
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - features/mcp-server/verdict-apply.feature
  - test/integration/mcp-migration.test.ts
  - test/integration/mcp-verdict-migration.test.ts
  - test/orchestrators/plugin/mcp-verdict.test.ts
  - test/orchestrators/plugin/update-preflight.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - test/orchestrators/reconcile/convergence.test.ts
  - test/orchestrators/reconcile/mcp-migration.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/orchestrators/reconcile/pending.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
  necessity: 0
status: clean
---

# Phase 3: Code Review Report (iteration 3)

**Reviewed:** 2026-11-04T20:10:48Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** clean

## Summary

This review covers the iteration-2 fix commits `git diff d3d2077 6775599`
(861f0bc, c84d579, e930997, 64aa17f; 6775599 is the fix report). I checked
them against 03-CONTEXT.md, DUBIOUS-CHOICES.md (P3-DC-112..127), 01-FROZEN.md,
and AGENTS.md. No frozen file changed. `recorded-servers.ts` and
`mcp-implementation.ts` are only imported.

What I checked:

- **Consent gates (D-MB-06, D-12, D-P3-13).** All three `degradeBaselineOf`
  call sites now pass the record and the active implementation: convergence
  `recordMove`, swap `partialDegradeOf`, and the `recordDegradeBaselineReader`
  port. No other code builds a baseline. `storedIsActive` matches rule 2 of
  the frozen `effectiveMcpCompatibility`: a record with no basis under the
  adapter gets its stored verdict back unchanged. So no switch can explain a
  drop that this verdict does not make. Under built-in and `none`, the WR-01
  excuse still applies.
- **Legacy and neutral record reads.** AMIG-01 now reads a moving owner's
  servers through the frozen `recordedMcpServers` and
  `createLegacyServersReader`. That reader pins the recorded root and refuses
  both `root-mismatch` and `version-mismatch`. `deriveInstallVersion` takes no
  lock and makes no network call, so calling it inside the migration's state
  transaction cannot deadlock. Every reader failure is caught and reads as
  `unreadable`. The verdict, basis, configs, and bundle flag are written
  together or not at all. An unreadable record stays fully legacy, with its
  adapter verdict, no basis, and no configs, as P3-DC-124 records.
- **AMIG-01 writes and NFR-1.** No new write path was added. The record still
  goes through the same locked state transaction.
- **Offline reads (NFR-5).** `mcp-migration.ts` imports no git surface. The
  new path reads only the cached manifest and the recorded root.
- **Import cycles.** `reconcile/mcp-migration.ts` now reaches
  `install-outcome.ts` through `recorded-servers.ts`. Nothing that
  `install-outcome.ts` reaches imports `reconcile/`. `npm run typecheck` and
  `npm run fallow` both pass on the current tree. The fallow run includes the
  cycle, health, and dupes gates.
- **Complexity.** `ownerAction`, `applyNeutralVerdict`, and `dropsNothingNew`
  stay within both ceilings. fallow health passes.
- **Test correctness.** Each new red case seeds the state it claims to seed.
  The swap and convergence adapter cases use records with no basis
  (`seedMcpRecordUpdate(cwd, {})` and `legacyMcpRecord`). The migration cases
  move the catalog past the record's version. The baseline table covers
  kind x basis x implementation. I re-ran the touched unit suites
  (`mcp-verdict`, `mcp-migration`, `update-preflight`): 187/187 pass.

Status of the iteration-2 findings:

- **WR-04:** resolved (861f0bc). An unreadable legacy record under the adapter now gives a readable baseline. A new adapter-only drop is declined by apply, reports `newlyDegraded: true` from update, and asks for `--partial` in a dependency move.
- **WR-05:** resolved (c84d579). AMIG-01 takes the verdict, basis, and configs only from the recorded version's servers, through the frozen MREC-02 version guard. A moved catalog leaves the record legacy (P3-DC-124).
- **WR-03:** resolved by accepted decision (e930997, P3-DC-122). The preview reads the active implementation again, as D-P3-15 requires. The pending/apply mismatch predates Phase 3 and goes to BACKLOG. The `@builtin-only` pending and apply scenarios pin both sides.
- **IN-04:** resolved (64aa17f). `dropsNothingNew` admits a candidate without `--partial` only when its view drops `mcpServers` alone. Any other kind keeps the old cascade `--partial` rule (P3-DC-126).
- **IN-03:** closed by decision (P3-DC-91). The defensive `marketplace-removed` guard in `partialDegradeOf` stays. It is not re-raised.

Follow-up, not a code finding: `.planning/BACKLOG.md` does not have the
P3-DC-122 parent line yet ("apply refuses a declared install pending previews
as will partially install; choose one behavior for both"). WR-03's
disposition depends on that line, so the orchestrator should add it before
the phase closes.

All reviewed files meet quality standards. No issues found.

---

_Reviewed: 2026-11-04T20:10:48Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 3_
