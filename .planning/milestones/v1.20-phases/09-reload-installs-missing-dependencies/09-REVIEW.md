---
phase: 09-reload-installs-missing-dependencies
reviewed: 2026-09-22T10:33:56Z
depth: standard
iteration: 3
files_reviewed: 12
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - docs/output-catalog.md
  - scripts/check-unused-type-members.contracts.json
  - tests/orchestrators/plugin/install-outcome.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
findings:
  critical: 0
  warning: 0
  info: 12
  total: 12
status: clean
---

# Phase 9: Code Review Report (iteration 3, final)

**Reviewed:** 2026-09-22T10:33:56Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** clean

## Summary

Narrowed re-review of the two iteration-2 fixes, `f9172700` (WR-01 restructure plus the IN-09 doc fold) and `3a2b8f5f` (WR-02 anchor renames), against the `d2ad4161..HEAD` range. The iteration-2 report is preserved at `09-REVIEW.iter3.md`; the fix report at `09-REVIEW-FIX.iter3.md`.

**Both iteration-2 Warnings are fixed and verified against source.** No Critical or Warning finding remains, so the phase closes `clean`. Twelve Info items are recorded: eight carried forward from iteration 2 with current line numbers, and four new ones from this pass (IN-10 to IN-13). IN-09 is resolved by the fold and retired.

**WR-01 (structural duplication).** Each verification the orchestrator asked for was checked directly against the working tree, not the fix report:

- *The derivation exists once.* `grep frontmatterDegradations.map` / `resolved.orphanRewake` over `extensions/` finds the install-side derivation only at `install-outcome.ts:1133-1138` (`ledgerDegradationSignals`). The hand-copied fold that was at `install-flow.ts:2196` is gone; `installMissingDependencyWithTransaction` now returns `...ledgerDegradationSignals(outcome.root)` at `install-flow.ts:2200`, and `installedPluginOutcome` spreads the same call at `install-outcome.ts:1116`. The `DegradeKind` import the old fold needed was removed from `install-flow.ts` (tsc and eslint clean, so nothing else read it).
- *Both apply-side projections consume one filter.* `installedRowDegradation` (`apply.ts:857-866`) is spread by the config-driven arm at `apply.ts:634` and by the reload arm at `apply.ts:734`, the latter gated on `member.key === rootKey` exactly as the `postCommitWarnings` spread three lines above it.
- *The silent-omission class on this seam is closed.* Any signal `ledgerDegradationSignals` emits reaches `InstallPluginOutcome` and `InstallMissingDependencyOutcome` from the same call, and any signal `installedRowDegradation` passes reaches the config-driven row and the reload row from the same call. There is no longer a reload-specific site where the reload row can drift from the config-driven row. What remains open is the wider, pre-existing form (a signal that is in `LedgerDegradationSignals` but not in the picked pair reaches neither row); that is the six-position `Pick<..., "orphanRewake" | "degradedKinds">` literal recorded as IN-13, and it is not the class iteration 1's WR-01 was about.
- *No import cycle.* `install-outcome.ts` imports `type LedgerDegradationSignals` from `./shared.ts`, a module it already imported from; `shared.ts` imports neither `install-outcome.ts` nor `enable-disable.ts`, and `install-outcome.ts` has no `enable-disable.ts` import (grep: only two JSDoc mentions at `:192` and `:549`). The fixer's documented deviation from the review sketch (`LedgerDegradationSignals` on the plugin side rather than `EnableDegradationSignals`, which is its alias at `enable-disable.ts:162`) is the correct choice for that reason.
- *Row bytes are unchanged.* `f9172700` touches no test other than `install-outcome.test.ts`, and `3a2b8f5f` changes only titles and one comment; the three iteration-1 apply cases (`{dependency installed, orphan rewake}` at `info`, `{dependency installed, dependency current copy}`, `{dependency installed, malformed skill}` at `warning`) still `deepStrictEqual`/`match` the same bytes. I re-ran `install-outcome.test.ts` (29/29) and the `SURF-05|TAGS-02|WARN-01|D-09-05|orphan|current copy` cases across `apply.test.ts`, `notify.test.ts`, `install-flow.test.ts` (24/24), plus `catalog-contract` and `notify-closed-set-locks` (8/8); `npx tsc --noEmit` exit 0; `eslint --max-warnings=0` on the six changed `.ts` files clean; `npm run lint:type-members` passed with the same five recorded exceptions.
- *The paired test pins the new export.* `install-outcome.test.ts:274` pins `{}` for the clean summary and `:301-304` pins `{ degradedKinds: ["skill", "command"], orphanRewake: true }` for the rich one, built independently of production (see IN-12 on placement).
- *The ten `contracts.json` pin moves are pure line shifts.* For each of the ten moved `id`/`refines`/`filter` positions I read the token at the new `line:col` in the working tree and at the old `line:col` in `d2ad4161`; all ten land on the same token (`readonly ok: false;`, `RunPhasesResult & {`, `status: "enabled" }>`, `Extract<EnableDisablePluginOut`, `readonly kind: "installed" }>` x2, `Extract<InstallCascadeResult`, `Extract<InstallLedgerResult`, `readonly status: "failed" }>`, `Extract<InstallPluginOutcome`). Columns are unchanged.

**WR-02 (anchor collisions).** After `3a2b8f5f`, a per-file count of every `WR-NN` token in the ten reviewed `.ts` files is identical to the count at the phase base `67da6cbf`; every remaining `WR-01`/`WR-02` anchor pre-dates the phase. The seven rewritten comments and three retitled cases carry only durable IDs (`SURF-05`, `WARN-01`, `TAGS-02`, `NREG-01`, `D-63-08`, `D-86-03`), and the two anchors the finding listed at `install-flow.ts:2007, 2194` and `apply.ts:741` were rewritten by `f9172700` to `SURF-05 / WARN-01`. The D-75-01 retired-vocabulary sweep of both diffs finds no `former` / `no longer` / `used to` narration; the two "rather than declaring" phrasings (`install-flow.ts:2012`, commit message) match the house idiom already at `apply-outcomes.ts:112` and `orchestrators/types.ts:178`.

**IN-09 fold.** The catalog paragraph (`docs/output-catalog.md:2801`) now names the tokens the root member's row and a current-copy member's row can carry; the `applyDependencyInstalls` JSDoc (`apply.ts:668-672`) says the root ledger run's signals ride the root member and `dependencyCurrentCopy` rides any member; the `REASONS` enrollment note (`notify-reasons.ts:81`) reads "rides only an `installed` row". That is the fix IN-09 proposed, so it is retired. `docs/dependency-resolution.md:220` still shows the bare `{dependency installed}` row as its worked example, which IN-09 did not ask to change and which is not wrong. One wording defect in the new catalog sentence is recorded as IN-10.

## Info

### IN-01: README still understates the marker's readers (carried forward)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/README.md:52`
**Issue:** "Exactly three readers decide anything on it" lists `isAlreadyDependencyDisabled`, `isDisabledIndependently`, `buildDependencyDisabledLift`. `plan.ts:756` (`record.dependencyDisabled === true` inside `isEligibleDependencyInstallDependent`) is a fourth reader that admits a dependent into the dependency-install bucket (D-09-02).
**Fix:** Say "four" and name the D-09-02 reader, or route `plan.ts:756` through `isAlreadyDependencyDisabled(record)` so the count stays literally true.

### IN-02: Test-side casts, a length assertion, a dynamic import, and duplicated narrowing in the entry-point cases (carried forward)

**File:** `tests/orchestrators/plugin/install-flow.test.ts:11609, 11691, 11828-11829, 11875-11876, 11933, 12062, 12096`
**Issue:** (a) `(outcome as { cause: string }).cause` at 11691, 12062, 12096 follows an `assert.ok(outcome.status === "failed" && ...)` that already narrows. (b) `assert.ok((outcome.postCommitWarnings ?? []).length > 0)` at 11829 asserts a length, not the warning text. (c) `await import(".../config-io.ts")` at 11609 inside a test body where the file's convention is a static import. (d) `assert.equal(outcome.status, "installed"); assert.ok(outcome.status === "installed");` appears in four cases, including the `SURF-05` orphan-rewake case at 11875-11876.
**Fix:** Read `outcome.cause` directly after the narrowing assertion; assert the exact `postCommitWarnings` array; hoist `loadConfig` to the import block; keep one narrowing assertion per case.

### IN-03: Substring assertions on reload rows (carried forward)

**File:** `tests/orchestrators/reconcile/apply.test.ts:4631-4636, 5169, 5504-5505, 5556-5558`
**Issue:** The `WARN-01` malformed-skill reload case at 4631 uses `assert.match(cascade?.message ?? "", /.../)` plus a separate `assert.equal(cascade?.severity, "warning")`. The marketplace-not-added (5169), failed-re-read (5504) and dangling-reference (5556) cases use `assert.match` / `includes`. The `SURF-05` and `TAGS-02` cases added in iteration 1 pin whole notifications, which is the form to copy.
**Fix:** Replace each with `assert.deepStrictEqual(notifications, [{ message: "...", severity: "warning" }, { message: "..." }])`, as `apply.test.ts:4671-4681` does.

### IN-04: History narration in a JSDoc and a test title (carried forward)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1104`; `tests/orchestrators/reconcile/notify.test.ts:917`
**Issue:** `applyToggleSteps`' doc still opens "extracted out of `applyPlan` so it can run this once ... Unchanged otherwise:". The test title "an outcome without the flag renders byte-identically to today" is the "byte-identical to what came before" claim the comment skill names as not a fact about current code.
**Fix:** "Runs the two `applyPluginToggles` calls and the LOAD-01 dependency-disable step against whichever plan is current: round 1's, or `refreshTogglePlan`'s D-09-07 replacement." Retitle the test "an outcome without the flag renders no reasons brace (NREG-01)".

### IN-05: Cross-marketplace member row form differs from D-09-09's wording (carried forward)

**File:** `docs/output-catalog.md:2801`; `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:720-721`
**Issue:** D-09-09 in `09-CONTEXT.md` says a cross-marketplace member "keeps the standalone cascade's `name@marketplace` key form"; the code files each member under its own marketplace block with a bare name, and the catalog documents that form. The decision record and the shipped surface still disagree and no phase summary records the deviation.
**Fix:** Record the deviation in the phase summary or amend D-09-09's text.

### IN-06: CHANGELOG line overstates what the reload enables (carried forward)

**File:** `CHANGELOG.md:12`
**Issue:** "and enables the plugin that needed it" reads as unconditional; a plugin the user disabled by hand stays disabled (D-09-02).
**Fix:** "... and brings back the plugin the load-time check had disabled for it."

### IN-07: Source-text regex test for the reason threading (carried forward)

**File:** `tests/index.test.ts:900-916`
**Issue:** The D-09-13 case reads `index.ts` as text and counts regex matches of the `applyReconcile({...reason: event.reason})` literal. The behavioral case at `tests/index.test.ts:918` already covers the contract.
**Fix:** Drop the regex case, or keep it only as long as the file's `reconcileConstructions` precedent stands.

### IN-08: The relative order of `dependency current copy` and `orphan rewake` is not pinned (carried forward)

**File:** `tests/orchestrators/reconcile/notify.test.ts:907, 987`
**Issue:** The renderer's order (`notify.ts:586-590`) is `dependency installed`, `dependency current copy`, `orphan rewake`, malformed tokens. The tests pin `["dependency installed", "dependency current copy"]` (907) and `["dependency installed", "orphan rewake", "malformed skill"]` (987). Swapping the current-copy spread below the orphan-rewake spread passes both, so the order the JSDoc documents at `notify.ts:578-581` is not fully guarded.
**Fix:** Give the ordering case at 987 all four flags (`dependencyInstalled`, `dependencyCurrentCopy`, `orphanRewake`, `degradedKinds: ["skill"]`) and pin `["dependency installed", "dependency current copy", "orphan rewake", "malformed skill"]` at `warning`.

### IN-10: The folded catalog sentence attaches the `warning` raise to both signals

**File:** `docs/output-catalog.md:2801`
**Issue:** The new sentence reads "carries the ledger's `{orphan rewake}` and `{malformed skill}` / `{malformed command}` signals (raising it to `warning`)". The parenthetical modifies the whole list, so a reader predicts `warning` for an orphan-rewake reload row; the row is `info` (`apply.test.ts:4641-4694` pins it, and the catalog's own SURF-05 entries at `:583`, `:1558`, `:3167` say "Severity `info`"). The `installedRowDegradation` JSDoc at `apply.ts:848-851` states it correctly.
**Fix:** "The root member's row also carries the ledger's `{orphan rewake}` signal and, raising it to `warning`, its `{malformed skill}` / `{malformed command}` signals; any member that fell back ..."

### IN-11: `ledgerDegradationSignals`' JSDoc claims every root-summary projection spreads it; the enable projection does not

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:1121-1130`; `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:368, 381-382`
**Issue:** The JSDoc says "Every projection of a root summary spreads this one derivation (`installedPluginOutcome` here, the reload dependency-install outcome in `install-flow.ts`)". `enable-disable.ts:368` (`Array.from(new Set(summary.frontmatterDegradations.map((d) => d.kind)))`) and `:381-382` are a third projection of the same `InstallLedgerSummary` with the same two spreads, untouched by this phase. `enable-disable.ts` already imports from `install-outcome.ts` (`:112`), so consuming the export there closes no cycle. This is pre-existing duplication outside the phase's diff; the finding is the new comment's overstatement.
**Fix:** Either replace `enable-disable.ts:368, 381-382` with `...ledgerDegradationSignals(summary)` (which makes the sentence true and removes the last hand-copy of the derivation), or reword the JSDoc to "Both install projections of a root summary spread this one derivation".

### IN-12: The new export's pins ride a case whose title names neither projection

**File:** `tests/orchestrators/plugin/install-outcome.test.ts:222, 274, 301-304`
**Issue:** The two `ledgerDegradationSignals` assertions were appended to "projects the complete empty-plugin summary and preserves a caller pin", a `runInstallLedger` case that already hosted the `installedPluginOutcome` pins the same way. The file has no `describe()` per entrypoint, so the pin for the new export is not discoverable by title. The placement follows the file's existing convention for `installedPluginOutcome`, which is why this is Info and not a Warning.
**Fix:** A top-level `describe("ledgerDegradationSignals")` with two cases, "omits both signals for a clean summary (NREG-01)" and "collects one degraded kind per parse failure and the orphan-rewake flag", each building its summary literal from a seed rather than from the `runInstallLedger` result.

### IN-13: The picked signal pair is spelled as a literal at six positions

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:1132`; `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:2022`; `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:111, 167`; `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:858-859`
**Issue:** `Pick<LedgerDegradationSignals | EnableDegradationSignals, "orphanRewake" | "degradedKinds">` is written out at six positions (two of them pre-existing at `apply-outcomes.ts:111, 167`). A signal added to `ledgerDegradationSignals`' body and return `Pick` reaches both rows at runtime, but the other five key lists stay narrower and compile clean (spread members are not excess-property checked), so the static types would describe fewer members than the values carry. This is the residual of the silent-omission class after the WR-01 restructure; the reload-vs-config drift the finding was about is closed.
**Fix:** One named alias next to the shape it picks, e.g. in `plugin/shared.ts`: `export type InstalledRowDegradationSignals = Pick<LedgerDegradationSignals, "orphanRewake" | "degradedKinds">;`, used at all six positions, so the key list exists once.

---

_Reviewed: 2026-09-22T10:33:56Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 3 (final)_
