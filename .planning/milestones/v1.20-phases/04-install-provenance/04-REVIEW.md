---
phase: 04-install-provenance
reviewed: 2026-09-16T18:26:44Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/plugin/install.messaging.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 4: Code Review Report

**Reviewed:** 2026-09-16T18:26:44Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** clean

## Summary

Iteration 5. Re-read the two iteration-4 fix commits (`77e69efb` CR-01, `a54d1519` IN-01) at source against `04-REVIEW.iter7.md`, the fixer's report (`04-REVIEW-FIX.md`, iteration 4), and the binding operator decisions (`04-REVIEW.iter2.md`). Scope was the four files and the diff since `27a516ee` only. Earlier iterations' fixes were not re-verified; the two backlogged items were not examined. The two touched test files were run directly (105/105).

All reviewed files meet quality standards. No issues found.

What was verified at source:

**CR-01 (`77e69efb`).**

- Placement. `stampReenabledWhereLocalDeclares` is called at `execute.ts:1021`, inside the `withLockedStateTransaction` closure and after the CFG-03 base-invalid early return (`:1008-1018`), before `mergeEnsureAndRepairs` and the base batch write. The base `current` snapshot (`:1020`) is unaffected by the local writes, so the batch still merges over a fresh base parse.
- Per-stamp re-read is necessary and correct. `writePluginConfigEntry` (`config-write-back.ts:116-133`) spreads the caller's `current` and saves the whole file; a single read shared by two re-enabled keys would have the second write spread the pre-first-write parse and drop the first stamp. The loop re-reads `configLocalJsonPath` on every iteration (`:1075`), so each write sees the one before it.
- Absent/invalid local cannot throw or drop the base stamp. `loadConfig` never throws (`config-io.ts:129-165`: ENOENT is `absent`, any other read failure, parse failure or schema failure is `invalid`). Both arms fall to `continue` (`:1076-1078`), leaving `ensure.plugins[key]` as `{ enabled: true }` from `buildBatchedPatchForScope` (`:1132`). The merged view under an invalid local coerces that arm to empty (D-18) and `applyReconcile` surfaces an `invalid-block` row rather than planning (`reconcile/apply.ts:176-189`), so the base stamp is the correct fallback and the user is told on the next reload.
- Sanctioned writer, no new raw write. The local write is `writePluginConfigEntry` -> `saveConfig` (schema check, `assertPathInside`, `atomicWriteJson`). The write-seam gate (`config-state-write-seams.test.ts:109-111`) pins `atomicWriteJson(<configLocalJsonPath>)` call sites only; `execute.ts` adds none. `saveConfig` takes no lock, so no self-deadlock inside the held scope lock.
- No `--local` conflict. Import carries no `--local` option (the only `local` token in `execute.ts` outside the new code is the header comment at `:974`; the edge handler has none), so the batch never targets the local file and the stamp cannot double-write it.
- NFR-5. The two new imports are `persistence/config-io.ts` and `persistence/config-write-back.ts`; neither reaches `platform/git.ts`. `orchestrators/import` is unchanged in its git surface.
- Parity with the enable verb. Where local declares the key, the stamp lands in local and the base batch drops to the bare key `{}` (`:1088`), which `writeBatchedConfigEntries` spreads over any existing base entry (`config-write-back.ts:204`). That is what `selectDeclaringConfigWriteTarget` (`plugin/shared.ts:658-695`) makes the enable verb do on the same configuration: write the declaring file, leave the sibling as it was. The operator rule "the promotion writes what the enable path writes" holds on both files.
- Tests are real. The `--local` mirror case (`execute.test.ts:2785-2917`) drives production collaborators (first import, `createNodeSetPluginEnabled(...)({ enable: false, local: true })`, second import), asserts the local file's bytes read `{ "dep@fixture-mp": { "enabled": true } }`, the base file's bytes carry the bare key, `loadMergedScopeConfig(project).merged.plugins["dep@fixture-mp"]` is `{ entry: { enabled: true }, source: "local" }`, and `planReconcile(...)` equals `emptyReconcilePlan("project")`. The identity-rule stub case (`:2919-2996`) seeds base `{ enabled: false }` and a local file declaring only `other@mp`, then asserts base reads `{ enabled: true }` and local is byte-unchanged; the base `{ enabled: true }` is discriminating because a missed stamp would spread `{}` over `{ enabled: false }` and leave it disabled.

**IN-01 (`a54d1519`).**

- `PROMOTED_ROW_REASONS` is exported from `install.messaging.ts:326-329` as `as const satisfies readonly ContentReason[]` and is the sole spelling of the tuple: `composePromotedRow` (`:368`) and the import row (`execute.ts:462`) both read it by reference. Every `reasons` field on the row types is `readonly ContentReason[]` (`notification-types.ts:229-323`), and the three `reasons.push` sites in the extension operate on locally-built arrays, so the shared tuple cannot be mutated through a typed path.
- Import gates. The ledger-module gate (`import-boundaries.test.ts:246-272`) matches `from "../plugin/<ledger>.ts"` inside the ledger files themselves; `execute.ts` is not a ledger and `install.messaging.ts` is not in `PLUGIN_LEDGER_TARGETS`. Both files are in fallow's single `orchestrators` zone. `install.messaging.ts` imports only `shared/`, `transaction/` types and `../types.ts`, so no cycle can form through it.
- The messaging test pins by reference (`assert.strictEqual(row.reasons, PROMOTED_ROW_REASONS)`, `install.messaging.test.ts:628`) and pins the tuple to the catalog literal in a second assertion; the two surfaces cannot drift in token set or order.

**New code, both commits.** `stampReenabledWhereLocalDeclares` has two guard `if`s in one loop; `writeBatchedConfigForScope` gained one `await` line. Both are well under the 15/20/60 ceilings, and the reported fallow run is green. Added comments cite `D-04-07`, `D-103-16`, `CFG-02` only; a scan of every added line finds no bare `PROV-NN`, phase, plan, wave, iteration or finding-ID reference. `D-103-16` and `CFG-02` are established anchors elsewhere in the tree.

---

_Reviewed: 2026-09-16T18:26:44Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
