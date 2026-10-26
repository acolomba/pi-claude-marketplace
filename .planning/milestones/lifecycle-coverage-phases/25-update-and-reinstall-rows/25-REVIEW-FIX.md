---
phase: 25-update-and-reinstall-rows
fixed_at: 2026-10-24T00:00:00Z
review_path: .planning/phases/25-update-and-reinstall-rows/25-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 9
skipped: 3
status: partial
---

# Phase 25: Code Review Fix Report

**Fixed at:** 2026-10-24
**Source review:** .planning/phases/25-update-and-reinstall-rows/25-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 12 (1 critical, 5 warnings, 6 info; the orchestrating session set the disposition of each)
- Fixed: 9
- Skipped: 3

**Where it ran:** every edit, commit, and gate ran in the main checkout of the
`claude/lc-p18-update-reinstall-742f3f` worktree, on its own branch. No nested
review-fix worktree was created, because that worktree would have had no
`node_modules` and could not run the gates. The final `npm run check` ran in the
same checkout, so its result reproduces from this tree.

## Fixed Issues

### CR-01: Spread of a possibly-undefined value in the cascade failure outcome

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`
**Commit:** 3f47fc60
**Applied fix:** The cascade failure outcome spreads `...(report.move ?? {})`. This matches the direct path's guard.

### WR-01: A commit on one side only draws a no-op-looking same-version arrow

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts`, `test/orchestrators/plugin/update-row.test.ts`
**Commit:** c131ec13
**Applied fix:** `revisionVersionSlot` computes `revisionCommits` first. At equal versions it returns the single `{ version }` unless both sides carry different commits. So a commit on one side only (D-07) renders `v1.0.0`, and the JSON row carries no `from` and no commit pair. The unit case that pinned the bare arrow now expects the single version. A from-side-only case was added. No scenario or catalog state pinned the old form. The cucumber update, reinstall, git-source-update, state-lock, rollback, and marketplace-update features passed unchanged. The `updated` row keeps its required `from`/`to` pair, as before.

### WR-02: Pre-candidate failures show the installed version when returned, but no version when thrown

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts`, `update-swap.ts`, `update-flow.ts`, `reinstall-flow.ts`, `reinstall-record.ts`; `features/plugin/git-source-update.feature`; `docs/output-catalog.md`; `test/architecture/catalog-uat/fixtures/plugin-reinstall.ts`, `test/architecture/catalog-uat/catalog-contract.test.ts`; `test/orchestrators/plugin/{update-preflight,update-flow,reinstall-flow}.test.ts`
**Commit:** 872b4944
**Applied fix:** `preparePluginUpdate` gains an optional `onRecord(fromVersion)` callback, reported on `ThreePhaseArgsBase` beside `onCandidate`. It fires once triage has found the record, before the constraint gate and the clone probe. Both flows' candidate holders now take `Partial<RevisionMove>`. `onRecord` seeds `{ fromVersion }`, and `onCandidate` later replaces it with the whole move. A thrown pre-candidate failure (a held lock in the unpinned probe, GIT-03; an unreadable dependency walk, D-18-17) now renders the installed version through `revisionVersionSlot`, as the returned preflight failures do (D-12). The fix stays outside the fence: `probeUnpinned`, `makeUpdateCloneProbe`, `clone-cache.ts`, `fetch.ts`, and `install-clone-probe.ts` are untouched. `resolveUpdateCandidate`'s catch order is unchanged (GHB-03 rethrow, then `StateLockHeldError` rethrow, then classification), and a held lock still fails as `lock held`. A layer refusal runs before the preflight, so it still shows no version on either verb. The git lock-held outline (update and reinstall) now states `version 1.0.0`, and the `reinstall-dependency-walk-unreadable` catalog state now shows `v1.0.0`.

### WR-03: `docs/json-output.md` says a row with `from` always carries `version`

**Files modified:** `docs/json-output.md`
**Commit:** 7fa7dcaa
**Applied fix:** The `version` cell now reads: "Plugin version. On a reinstalled, partially installed, or failed row that carries `from`, the version it moved to; an updated row carries `to` instead."

### WR-04: The triage comment claims a record-first order that the preflight does not follow

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts`, `test/orchestrators/plugin/update-preflight.test.ts`
**Commit:** 6d776185
**Applied fix:** `triageUpdateMembership` now takes the marketplace record and is async. It checks the install record first, and it loads the manifest only when a record exists. A not-installed target therefore fails `{not installed}` before any manifest read (upstream order, D-02). `preparePluginUpdate` stays at the same complexity. The UPR-04 comment now states the real order. New unit case: an unreadable manifest plus a not-installed target gives `failed {not installed}`.

### WR-05: A range-admitted `--partial` update drops the disclosure that the same reinstall shows

**Files modified:** `extensions/pi-claude-marketplace/shared/notification-types.ts`, `shared/notification-resolve.ts`, `orchestrators/plugin/update-row.ts`; `docs/json-output.md`, `docs/messaging-style-guide.md`, `docs/output-catalog.md`; `test/architecture/catalog-uat/{fixtures/plugin-update.ts,catalog-contract.test.ts,catalog-parser.test.ts,catalog-wire.test.ts}`; `test/orchestrators/plugin/update-row.test.ts`, `test/shared/notification-resolve.test.ts`
**Commit:** 7a864823
**Applied fix:** This was a small, consistent grammar extension. `PluginPartiallyInstalledMessage` gains an optional `cause` (D-10-13). `resolveRow` sends `partially-installed` through the same branch as `updated`/`reinstalled`, so the cause becomes the row's `failure` and renders in text and JSON with no grammar or wire change: the plugin-row wire schema already has an optional `cause`. `updatedRowFromOutcome` computes `constraintCauseFor` before the partial arm and attaches it there. The docs (JSON `cause` cell, style guide) name the partial row. A new catalog state, `update-partial-current-copy`, has its fixture. The catalog count pins moved from 306 to 307 states and from 316 to 317 presented rows, and the byte pin was updated.

### IN-01: Two identical per-target candidate holders

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts`, `update-flow.ts`, `reinstall-flow.ts`; `test/orchestrators/plugin/materialize-latest.test.ts`
**Commit:** fa9c56ed
**Applied fix:** `CandidateReport` and `recordCandidate` (which now returns both `onRecord` and `onCandidate`) moved to `materialize-latest.ts`. That is the shared runner leaf both flows already import, so BLOCK C is unaffected. Both flows use it. Two unit cases cover the holder after a derived candidate and after a returned verdict. Fallow stays green.

### IN-04: The source-access classifier doc still says update uses the transport ladder

**Files modified:** `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts`
**Commit:** b3c01084
**Applied fix:** The comment now reads "the transport and host ladders that update and the plugin verbs use leave a missing ref unclassified."

### IN-06: Comment and doc lines over the 100-column width

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts`, `update-preflight.ts`
**Commit:** 94602dfd
**Applied fix:** Both comments are rewrapped at 100 columns. One line in `update-preflight.ts` is still over 100 columns, but it is a template-literal string in code, not a comment. It predates this phase, so it was left as is.

## Skipped Issues

### IN-02: The reconcile remedy's comma-joined ranges read as part of the sentence's own list

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:412`
**Reason:** Skipped by disposition. The remedy wording is a user-visible text decision. INR-05 settled the `, ` form after Claude Code's own join. Bracketing or rewording it changes reconcile's output and catalog states, so it needs a user decision on the wording.
**Original issue:** Two declared ranges render as `to satisfy ^1.0.0, >=1.2.0, or uninstall ...`, and a reader can take a range for a third alternative.

### IN-03: Update's invalid and too-complex cause lines drop the diagnostic that install's lines keep

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:214-225`
**Reason:** Skipped by disposition. D-20 asked for the declared-range form on every arm, and the review calls the fix optional. Bringing back the fold detail is a design choice on the cause-line content, not a defect.
**Original issue:** `describeConstraint` no longer receives `fold.detail`, so update names every declared range but not which one is unreadable or which limit was exceeded.

### IN-05: The move-row types allow shapes the text and the wire render differently

**File:** `extensions/pi-claude-marketplace/shared/notification-types.ts:448-451`
**Reason:** Skipped by disposition. `revisionVersionSlot` is the only producer of these fields, and it never builds the inconsistent shapes. Making the slot a discriminated union changes three message types and every consumer of `RevisionMoveFields`. That is a type redesign, larger than an Info finding warrants.
**Original issue:** `from` and `commits` are independently optional, so a producer could set `commits` without `from`, or `from` without `version`.

## Verification

- Every fix ran the commit hook's `npm run check:commit` (static checks, unpaired tests, and direct coverage for the staged pairs). All passed.
- Unit tests ran in hermetic homes (scratch `HOME` and `PI_CODING_AGENT_DIR`, plus each test's `withHermeticHome`). Cucumber ran in its own sandbox.
- Final gate: `npm run check` in this checkout, after the last fix commit (fa9c56ed): exit 0. The static checks, unpaired tests, integration tests, cucumber (758 scenarios, 7214 steps, all passed), and direct coverage over all pairs (280 LCOV records merged) all passed.

---

_Fixed: 2026-10-24_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
