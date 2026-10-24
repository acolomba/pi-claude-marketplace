---
phase: 25-update-and-reinstall-rows
verified: 2026-10-24T09:30:00Z
status: passed
score: 4/4 roadmap success criteria verified (plus 7/7 folded-in decision checks)
covered_files:
  - ".agents/skills/cucumber/rules/features.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-01-PLAN.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-01-SUMMARY.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-02-PLAN.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-02-SUMMARY.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-03-PLAN.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-03-SUMMARY.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-04-PLAN.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-04-SUMMARY.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-05-PLAN.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-05-SUMMARY.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-06-PLAN.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-06-SUMMARY.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-07-PLAN.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-07-SUMMARY.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-08-PLAN.md"
  - ".planning/phases/25-update-and-reinstall-rows/25-08-SUMMARY.md"
  - "docs/dependency-resolution.md"
  - "docs/json-output.md"
  - "docs/messaging-style-guide.md"
  - "docs/output-catalog.md"
  - "docs/prd/pi-claude-marketplace-prd.md"
  - "extensions/pi-claude-marketplace/domain/dependency-range.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts"
  - "extensions/pi-claude-marketplace/orchestrators/types.ts"
  - "extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts"
  - "extensions/pi-claude-marketplace/shared/notification-grammar.ts"
  - "extensions/pi-claude-marketplace/shared/notification-json.ts"
  - "extensions/pi-claude-marketplace/shared/notification-resolve.ts"
  - "extensions/pi-claude-marketplace/shared/notification-types.ts"
  - "extensions/pi-claude-marketplace/shared/notification-wire.ts"
  - "features/lib/run-tokens.ts"
  - "features/marketplace/update.feature"
  - "features/plugin/fetch.feature"
  - "features/plugin/git-source-update.feature"
  - "features/plugin/list.feature"
  - "features/plugin/reconcile.feature"
  - "features/plugin/reinstall.feature"
  - "features/plugin/state-lock.feature"
  - "features/plugin/update-rollback.feature"
  - "features/plugin/update.feature"
  - "features/support/world.ts"
  - "schema/claude-plugin.schema.json"
  - "test/architecture/catalog-uat/catalog-contract.test.ts"
  - "test/architecture/catalog-uat/catalog-parser.test.ts"
  - "test/architecture/catalog-uat/catalog-wire.test.ts"
  - "test/architecture/catalog-uat/fixtures/marketplace-update.ts"
  - "test/architecture/catalog-uat/fixtures/plugin-reinstall.ts"
  - "test/architecture/catalog-uat/fixtures/plugin-update.ts"
  - "test/architecture/catalog-uat/fixtures/reconcile-applied.ts"
  - "test/architecture/notify-producer-wire-coverage.test.ts"
  - "test/domain/dependency-range.test.ts"
  - "test/edge/handlers/plugin/reinstall.test.ts"
  - "test/integration/plugin-layer-verbs.test.ts"
  - "test/integration/reserved-record-keys.test.ts"
  - "test/orchestrators/marketplace/update.messaging.test.ts"
  - "test/orchestrators/marketplace/update.test.ts"
  - "test/orchestrators/plugin/list-candidate-version.test.ts"
  - "test/orchestrators/plugin/list-installed-row.test.ts"
  - "test/orchestrators/plugin/materialize-latest.test.ts"
  - "test/orchestrators/plugin/operations.test.ts"
  - "test/orchestrators/plugin/reinstall-flow.test.ts"
  - "test/orchestrators/plugin/reinstall-record.test.ts"
  - "test/orchestrators/plugin/reinstall.messaging.test.ts"
  - "test/orchestrators/plugin/shared.test.ts"
  - "test/orchestrators/plugin/update-cascade.test.ts"
  - "test/orchestrators/plugin/update-constraint-gate.test.ts"
  - "test/orchestrators/plugin/update-flow.test.ts"
  - "test/orchestrators/plugin/update-preflight.test.ts"
  - "test/orchestrators/plugin/update-row.test.ts"
  - "test/orchestrators/plugin/update-swap.test.ts"
  - "test/orchestrators/plugin/warm-mirror-seed.ts"
  - "test/orchestrators/reconcile/apply-outcomes.test.ts"
  - "test/orchestrators/reconcile/dependency-verdict.test.ts"
  - "test/orchestrators/types.test.ts"
  - "test/shared/notification-grammar.test.ts"
  - "test/shared/notification-json.test.ts"
  - "test/shared/notification-resolve.test.ts"
  - "test/shared/notification-types.test.ts"
covered_digest: "v3:sha256:d8b7a1548ebe4a56886f978dd1791b1d8ace630dd9ab316a8f2be656afa49b72"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 25: Update and Reinstall Rows Verification Report

**Phase Goal:** Update and reinstall rows always say which version and commit moved, and refusals match `uninstall`.
**Verified:** 2026-10-24T09:30:00Z
**Status:** passed
**Re-verification:** No. This is the first verification.
**Tree:** branch `claude/lc-p18-update-reinstall-742f3f`, HEAD `f7b06988`.

## Goal Achievement

### Observable Truths (roadmap success criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | An update to a new commit at the same declared version renders `1.0.0 (<sha7>) → 1.0.0 (<sha7>)` (UPR-02) | ✓ VERIFIED | `update-swap.ts::preflightMove` (~1530) stamps `fromCommit` = `preflight.record.resolvedSha` and `toCommit` = `preflight.resolvedSha`. `update-row.ts::revisionCommits` adds commits only when the versions are equal, both sides have a commit, and the commits differ. `notification-grammar.ts::composeVersionArrow` draws `v<from> (<7hex>) → v<to> (<7hex>)`. JSON `fromCommit`/`toCommit` come from `notification-json.ts::commitFields`. Cucumber: `git-source-update.feature:79` (update, `from commit`/`to commit` = `{ghp commit 1}`/`{ghp commit 2}`) and `:131` (reinstall after `fetch`). Catalog: `docs/output-catalog.md:2103` and `:1745`. The named grammar tests `UPR-02: …` ran: 4/4 pass. The text carries the house `v` prefix (`v1.0.0 (abc1234) → v1.0.0 (def5678)`), as D-05 recorded. |
| 2 | `partially-installed` and `failed` update rows show the version and from/to where known (UPR-03) | ✓ VERIFIED | `PLUGIN_ROW_LAYOUT` gives `reinstalled`, `partially-installed`, and `failed` the `move` slot. That slot draws `from → version` when `from` is present, and otherwise the single version. `update-row.ts::revisionVersionSlot` is the one producer, and both cascades and reinstall use it. Pre-candidate failures carry `fromVersion` through `failedCandidate` and the `onRecord` callback (WR-02). Cucumber: `update.feature:419` (partial `1.0.0 → 1.1.0`), `update-rollback.feature:29` (failed mcp phase `1.0.0 → 1.1.0`), `update.feature:105` and `git-source-update.feature:184-216` (failed, installed `1.0.0`), `reinstall.feature:286` (reinstalled `1.0.0 → 1.1.0`). A failure with no record carries no version (`StaticPreflightRowOptions` pins `fromVersion?: never` on `failed`). |
| 3 | `reinstall` of a plugin that is not installed reports `failed {not installed}` (UPR-04) | ✓ VERIFIED | `reinstall-flow.ts:376-381` returns `recordReinstallOutcome({ partition: "failed", reason: "not installed" })` before the runner starts. `update-preflight.ts::triageUpdateMembership` checks the record before it loads the manifest (WR-04) and returns `failed {not installed}`. The cross-scope form `emitMarketplaceNotAddedSignal` emits a `failed` row with `absentTargetReasons`. Backfill treats `not installed` as a silent converge (`backfill.ts:449-454`). Cucumber: `reinstall.feature:226` and `update.feature:66` (both `failed {not installed}`, severity `error`, no file changed). Unit tests: `update-flow.test.ts:12303` (autoupdate per-plugin path) and `backfill.test.ts:2587` (BFILL-01). |
| 4 | `npm run check` stays green | ✓ VERIFIED | One run in a hermetic `HOME`/`PI_CODING_AGENT_DIR` (scratch dir): **exit 0**. Static checks (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features) passed, then unpaired, integration, and cucumber (**758 scenarios, 7214 steps, all passed**), then direct coverage (280 LCOV records merged). |

**Score:** 4/4 roadmap truths verified (0 present, behavior-unverified).

### Folded-in decisions (25-CONTEXT D-14..D-22, checked against code)

| # | Check | Status | Evidence |
| --- | --- | --- | --- |
| F1 | `resolveUpdateCandidate`'s catch keeps the GHB-03 rethrow first, then the `StateLockHeldError` rethrow, then classification (D-18, GIT-03) | ✓ VERIFIED | `update-preflight.ts:477-489`: `rethrowInvalidGitHubBaseUrl(error)` comes first, then `if (error instanceof StateLockHeldError) throw error`, then `candidateFailure(...)`. Tests: `update-preflight.test.ts:1420` (GHB-03) and `:1959` (GIT-03 lock held, which also reports the installed version). The cucumber lock-held outline is at `git-source-update.feature:156`. |
| F2 | A missing path-source directory reads `failed {source missing}` on update and reinstall (D-16, SRC-01) | ✓ VERIFIED | `candidateFailure` narrows a `no-longer-installable` shape whose notes narrow to `source missing` to `failedCandidate(..., ["source missing"])`. Cucumber: `update.feature:87` and `reinstall.feature:251`. Catalog state: `update-source-missing`. |
| F3 | A failed clone reads its host/transport reason, not `{no longer installable}` (D-16/D-17, IN-05) | ✓ VERIFIED | `candidateFailure` runs `classifyGitHostFailure` first and keeps the cause, except on a bare auth row. An unclassified throw gives a `failed` row with no reason and its cause chain. `reinstall.messaging.ts:292` uses `{unreadable}` only when no cause is present. Cucumber outline: `git-source-update.feature:184` (404 → `source missing`, dropped → `network unreachable`, 503 → `network error`, each with its cause chain). Reinstall unit test: `reinstall-flow.test.ts:4333`. Catalog state: `update-host-failure`. |
| F4 | `list` upgradable compares the plugin.json version by the one version rule (D-19) | ✓ VERIFIED | `list-candidate-version.ts::resolveListCandidate` is shared by the candidate rows and the installed rows. `list-installed-row.ts:89` uses `resolved?.version ?? manifestEntry.version`. Cucumber: `list.feature:734`. `fetch.feature` now expects `upgradable` after a fetch. |
| F5 | Declared ranges print `, `-joined (D-20/D-21) | ✓ VERIFIED | `domain/dependency-range.ts::renderDeclaredRanges` is the one helper. Install's cascade, `update-constraint-gate.ts::describeConstraint`, and `reconcile/dependency-verdict.ts::unsatisfiedRange` all use it. Unit tests: `update-constraint-gate.test.ts:165,217,332` (`^1.0.0, ^2.0.0`, `^1.0.0, >=1.2.0`). The cucumber cause chains name one holder, so no scenario shows the comma form on update (Info). |
| F6 | Constraint cause line on `updated` and `reinstalled` rows (D-22, WR-07) | ✓ VERIFIED | `update-row.ts::updatedRowFromOutcome` attaches `constraintCauseFor(outcome)` to both the `updated` and the `partially-installed` forms. Reinstall copies `run.constraint` onto its outcome. Cucumber: `update.feature:345` and `reinstall.feature:142` (`constrained to the combined range (^1.0.0) -- required by "app@tools"`). |
| F7 | Phase 26 fence (D-23): `clone-cache.ts`, `fetch.ts`, `info.ts`, `install-clone-probe.ts`, `makeUpdateCloneProbe`/`probeUnpinned` are not edited | ✓ VERIFIED | `git diff 2baa5a12 HEAD --name-only` lists none of these files, and the `update-preflight.ts` diff has no hunk in `probeUnpinned` or `makeUpdateCloneProbe`. The phase did edit one scenario in `features/plugin/fetch.feature`, a file Phase 26 owns, because D-19 changes the list row from `installed` to `upgradable`. |

**Intentional supersession (not a gap):** the 25-08 plan says that the `partially-installed` form "has no cause slot" and stays unchanged. Review fix WR-05 (`7a864823`) later gave `PluginPartiallyInstalledMessage` an optional `cause`, so a partial update discloses its admitting range as a partial reinstall does. The review fix records this in `25-REVIEW-FIX.md`, and the catalog has the new state `update-partial-current-copy`.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `shared/notification-grammar.ts` | commit arrow, `move` slot | ✓ VERIFIED | `composeVersionArrow(from, to, commits?)`, `PLUGIN_ROW_LAYOUT` `move` for three statuses |
| `shared/notification-types.ts` | `VersionCommits`, `RevisionMoveFields` | ✓ VERIFIED | on updated, reinstalled, partially-installed, failed messages |
| `shared/notification-json.ts` | `from`, `fromCommit`, `toCommit` | ✓ VERIFIED | `commitFields`, additive (`schemaVersion` 1) |
| `schema/claude-plugin.schema.json`, `docs/json-output.md` | admit the new fields | ✓ VERIFIED | the wire tests and cucumber JSON comparisons pass |
| `orchestrators/plugin/update-row.ts` | the one version/commit rule | ✓ VERIFIED | `revisionVersionSlot`, `revisionCommits`, `constraintCauseFor` |
| `orchestrators/plugin/update-preflight.ts` | catch order, record-first triage | ✓ VERIFIED | see F1, T3 |
| `orchestrators/plugin/reinstall-flow.ts`, `reinstall-record.ts` | failed not-installed, move fields | ✓ VERIFIED | see T2, T3 |
| `orchestrators/plugin/list-candidate-version.ts` (new) | shared version derivation | ✓ VERIFIED | imported by the candidate rows and the installed rows |
| `docs/output-catalog.md` + catalog fixtures | new and changed states | ✓ VERIFIED | `EXPECTED_STATE_COUNT` 300 → 307, bytes 48,699 → 49,960 |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `update-swap.ts::preflightMove` | `update-row.ts::revisionVersionSlot` / `revisionCommits` | `RevisionMove` on the outcome | WIRED |
| `update-row.ts` | `marketplace/update.messaging.ts` (autoupdate) | shared composer | WIRED (D-10, `f4ad5b3e` autoupdate failed-row test) |
| `reinstall-record.ts::reinstallOutcomeFromRun` | `reinstall.messaging.ts` | `fromVersion` + `knownCommits` / `knownMove` | WIRED |
| `materialize-latest.ts::recordCandidate` | `update-flow.ts`, `reinstall-flow.ts` | `onRecord` / `onCandidate` | WIRED (IN-01 consolidation) |
| `renderDeclaredRanges` | install cascade, update gate, reconcile verdict | import from `domain/dependency-range.ts` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Commit arrow on all four move statuses | `node --test --test-name-pattern="UPR-02" test/shared/notification-grammar.test.ts` (hermetic HOME) | 4 pass, 0 fail | ✓ PASS |
| Whole gate | `npm run check > <scratch>/check.log 2>&1; echo $?` (hermetic HOME) | exit 0; 758/758 scenarios, 7214/7214 steps | ✓ PASS |

### Probe Execution

No probes are declared, and none exist under `scripts/*/tests/probe-*.sh`. Not applicable.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| UPR-02 | 25-03, 25-05 | ✓ SATISFIED | T1 |
| UPR-03 | 25-04, 25-05, 25-07, 25-08 | ✓ SATISFIED | T2, F6 |
| UPR-04 | 25-06 | ✓ SATISFIED | T3 |
| INR-05, VER-01, VER-02, SRC-01 (folded-in; their own phases own them) | 25-01, 25-02, 25-07 | ✓ SATISFIED for the update/reinstall/list surfaces | F2-F5 |

No orphaned requirements: REQUIREMENTS.md maps only UPR-02, UPR-03, and UPR-04 to Phase 25, and plans claim all three.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (phase diff `2baa5a12..HEAD`, 84 non-planning files) | -- | TBD/FIXME/XXX/TODO/HACK on added lines | none found | -- |
| `orchestrators/plugin/update-preflight.ts` | one template-literal line | over 100 columns | ℹ️ Info | predates the phase (IN-06 note); Prettier accepts it |

### Human Verification Required

None. Unit byte tests, the catalog contract, and cucumber JSON comparisons pin every row this phase changes.

### Gaps Summary

No gaps. Every roadmap success criterion and every folded-in decision has code, wiring, and a passing test, and the full gate exits 0.

## For the user

User-visible behavior changes in this phase:

- **Same-version commit arrow.** An update or reinstall that moves a git plugin to a new commit at the same declared version now reads `● ghp v1.0.0 (abc1234) → v1.0.0 (def5678) (updated)`, with the house `v` prefix. The JSON row gains `fromCommit` and `toCommit` (full 40-hex). Commits show only when the versions are equal and both sides have different commits, so a commit on one side only reads as the single `v1.0.0`.
- **Version moves on more rows.** `reinstalled`, `partially-installed`, and `failed` rows now show `v<from> → v<to>` when the revision moved. A failure before a candidate exists shows the installed version. A same-revision reinstall keeps its single version. The JSON adds `from` beside `version`.
- **Not installed.** `update` and `reinstall` of a plugin with no install record now read `(failed) {not installed}` at `error` severity, as `uninstall` does. An update of a never-installed plugin that the manifest no longer lists used to read `{not in manifest}` and now reads `{not installed}`, because the record is checked first, as upstream does. The cross-scope form is a `failed` row as well.
- **Autoupdate:** when a record is removed while `marketplace update` runs, the autoupdate row is now `failed {not installed}` (it was `skipped {not installed}`). That counts as a failure in the tally and the summary.
- **Missing or refused sources.** A path plugin whose directory is gone now reads `failed {source missing}` on update and reinstall. A git host refusal reads install's reason (`source missing`, `network unreachable`, `network error`, `authentication required`) with its cause chain. It no longer reads `skipped {network unreachable}` or `{no longer installable}`. This applies to both update cascades, reinstall, and backfill.
- **Range text.** Constraint cause lines and reconcile's version remedy now name the declared ranges joined with `, ` (Claude Code's form), not the folded intersection. `updated`, `reinstalled`, and `partially-installed` rows carry the admitting-range cause line.
- **`list` upgradable** now compares the version an install would record (plugin.json first). A path plugin whose entry version differs from its plugin.json no longer shows as upgradable when plugin.json matches the record. After a `fetch` that brings a newer version, `list` shows `upgradable`, where it used to show `installed` (`fetch.feature` was updated to match).
- **Catalog:** the output catalog grew from 300 to 307 documented states (UTF-8 byte pin 48,699 → 49,960). The review fix reports 317 presented rows.

Deferred items and open decisions:

- **IN-02 (skipped, needs your wording call):** reconcile's remedy `to satisfy ^1.0.0, >=1.2.0, or uninstall ...` can make a range read like a third alternative.
- **IN-03 (skipped):** update's `invalid` and `too-complex` cause lines no longer name which range failed or which limit was hit. Install's lines still do.
- **IN-05 (skipped):** `RevisionMoveFields` allows `commits` without `from`. Only one producer exists, and it never builds that shape, so the risk is latent.
- **D-17 offline backfill:** a backfill promotion whose source cannot be fetched now emits a `plugin-install-failed` row and keeps the version gate open. An offline user sees that row and a retry on every load until the host is reachable again. The decision accepted this. No backfill unit test drives a host failure; the existing generic failed-arm handling covers it.
- **Tab completion still compares entry versions:** `orchestrators/edge-deps.ts::classifyInstalledPluginRow` (~125) still uses `manifestEntry.version !== installed.version`. Completion can offer `update` for a plugin that `list` shows as installed, and the reverse.
- **Same-version commit moves are not upgradable in `list`:** D-19 compares versions only. A git plugin whose mirror HEAD moved at the same declared version shows `installed`, even though `update` would move it and show the commit arrow. `info` has the same limit.
- **WR-06** (a delisted record blocks every update and reinstall in its scope) still needs your decision. Physical rollback of a failed commit is still deferred from Phase 18.
- The commit form follows your `1.0.0 (abc) -> 1.0.0 (def)` choice. Parentheses therefore appear twice on a row, for the commits and for the status token. The house `v#abc1234` form was the alternative.

---

_Verified: 2026-10-24T09:30:00Z_
_Verifier: Claude (gsd-verifier)_
