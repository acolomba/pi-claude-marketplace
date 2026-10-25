---
phase: 02-plugin-enable-and-disable
verified: 2026-10-23T10:57:55Z
status: passed
score: 5/5 roadmap success criteria verified
covered_files:
  - .planning/phases/02-plugin-enable-and-disable/02-01-PLAN.md
  - .planning/phases/02-plugin-enable-and-disable/02-01-SUMMARY.md
  - .planning/phases/02-plugin-enable-and-disable/02-02-PLAN.md
  - .planning/phases/02-plugin-enable-and-disable/02-02-SUMMARY.md
  - CHANGELOG.md
  - docs/output-catalog.md
  - docs/plugin-enablement.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - features/plugin/disable.feature
  - features/plugin/enable.feature
  - test/architecture/catalog-uat/fixtures/plugin-enable.ts
  - test/orchestrators/plugin/enable-disable.messaging.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
covered_digest: "v3:sha256:380a0bbcb14e73abf83b134c523d5bbc24a4d818e0aad803560b6f059fe5ae2d"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 2: Plugin Enable and Disable Verification Report

**Phase goal:** `enable` and `disable` have scenarios for every lifecycle behavior: skills come and go across sessions while the plugin stays installed, a no-op is skipped, each scope changes alone, dependencies behave as in Claude Code, and a plugin that is not installed fails.
**Verified:** 2026-10-23T10:57:55Z, on the combined milestone tree at HEAD `7a9b6107` (all 15 phases merged)
**Status:** passed
**Re-verification:** Yes. The earlier report (HEAD `9b58305c`) went stale when later phases touched covered files. This pass re-checks every criterion against the current tree.

## What changed since the last verification

`git log 9b58305c..HEAD` on the covered product, test, and feature files shows later-phase merges and these relevant commits:

- `4b756cf5` (this phase's follow-up): re-padded the `cause chain` column in `features/plugin/enable.feature` (old W-1), fixed the "sorted" wording in the catalog (old I-3), and fixed the broken comment in `enable-disable.ts`. I confirmed each in the tree: the table at `enable.feature:220-221` is aligned, `docs/output-catalog.md:4133` now says "in closure order, comma-joined", and the comment reads cleanly.
- `2f06d184` (Phase 15, state lock): a held state lock on a standalone `enable`/`disable` now renders `(failed) {lock held}` through the new `standaloneTransactionThrowReasons` helper in `enable-disable.ts`, with a unit test that checks the notification text and that the state bytes stay unchanged. This extends how a standalone transaction throw is classified. It does not touch any behavior this phase's criteria assert: the refusal arm (`EnableRefusedError` -> `[cause.reason]`) is unchanged.

`features/plugin/disable.feature` is unchanged since the last verification. `enable.feature` changed only in the column padding. No later phase altered the enable/disable orchestrator's closure, no-op, scope, or refusal logic.

## Method

Goal-backward. For each success criterion I read the scenarios in `features/plugin/enable.feature` and `features/plugin/disable.feature` and asked whether a plausible wrong implementation would still pass. The step semantics that make the scenarios strong, unchanged from the first verification:

- `the result has these fields:` and `the result lists these plugins:` compare the whole envelope and every row. A column the table leaves out is appended by `namesLike`, so an extra field fails.
- `the "<file>" file of the <scope> scope declares these plugins:` compares every declaration and every field of each entry.
- `the installation record of the <scope> scope holds these plugins:` compares the whole sorted set of `(id, version, enabled)`.
- `the session offers these skills:` / `offers no skills` compare the whole skill list of a real new Pi session; the world's `After` hook fails a scenario whose results or rows go uncompared.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | After `disable`, a new session offers none of the plugin's skills and `list` shows it installed and disabled. After `enable`, a new session offers its skills again and the scope holds exactly one installation record (ENA-01, ENA-02). | VERIFIED | `disable.feature:59` "Disabling an enabled plugin offers none of its skills and keeps it installed" (record, config, `list --scope project`, `session offers no skills`). `enable.feature:55` "Enabling a disabled plugin offers its skills again and keeps one installation record" (whole-set record check, session offers `/skill:demo-skill`). Both pass on the current tree. |
| 2 | Enabling an enabled plugin and disabling a disabled one report a skipped row with the matching no-op reason. Enable and disable of a plugin that is not installed fail with the not-installed reason (ENA-03, ENA-06). | VERIFIED | `enable.feature:74`, `disable.feature:90` (skipped rows `already enabled` / `already disabled`, no reload, records and configs unchanged). `enable.feature:91`, `disable.feature:108` (`severity error`, reason `not installed`, config declares nothing). All pass. |
| 3 | With `--scope user` and `--scope project`, enable and disable change only the named scope (ENA-04). | VERIFIED | Four scenarios: `enable.feature:105`, `:136`, `disable.feature:120`, `:151`. Each installs in both scopes, changes one, and compares both scopes' records and base configs plus sessions in the project and in another project. All pass. |
| 4 | Enabling a plugin whose dependencies are disabled or absent enables or installs them and reports each; disabling a plugin an enabled plugin depends on is refused or cascaded as Claude Code does, and the title says which (ENA-05). | VERIFIED (per D-02) | `enable.feature:169` enables a disabled dependency and reports two rows. `enable.feature:202` "...whose dependency is not installed fails as dependency unsatisfied" (failed row, reason, cause `Install lib@tools first, then enable app@tools.`, record and config stay false). `disable.feature:180` "...fails as dependents remain". Product code: `resolveEnableCascade` (`enable-disable.ts:817-820`) throws `EnableRefusedError("dependency unsatisfied", composeEnableMissingDependencyCause(...))` inside the locked transaction when `refuseMissing` is set and a closure member has no record; `refuseMissing` is `isRecordedButDisabled(installed)` (`:1412`), so an already-enabled root skips (D-09). The absent-dependency arm refuses rather than installs, which is what Claude Code does (`dependency_missing`, confirmed in the 2.1.309 binary at the first verification) and is licensed by D-02. See W-1. |
| 5 | The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green. | VERIFIED | `npx cucumber-js --parallel 2 features/plugin/enable.feature features/plugin/disable.feature`: 17 scenarios, 259 steps, all passed, exit 0 (this verification). `npm run check:features`: exit 0 (this verification). `node --test` on both enable-disable unit files: run for this phase at the first verification, and the file now also carries the Phase 15 lock-held test; the orchestrator's `npm run check` on this exact tree is green (static checks, unpaired, integration, 702/702 cucumber scenarios, direct coverage), which covers every source-test pair including these two. |

**Score:** 5/5. 0 present-but-behavior-unverified.

### Plan must-haves

| Plan | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 02-01 | An `enable` whose closure holds an uninstalled member is refused with `{dependency unsatisfied}` and an install-first cause, and nothing changes. | VERIFIED | `enable-disable.ts:817-820`; scenario `enable.feature:202` checks row, record, config; unit tests check state bytes. |
| 02-01 | A closure whose members are all installed behaves as before. | VERIFIED | `enable.feature:169`; unit suite passes under `npm run check`. |
| 02-01 | The `not-installed` disposition and its warning skip row are gone. | VERIFIED | `enable-disable.ts:752` yields only `"re-enabled"` / `"already-enabled"`. |
| 02-01 | `npm run check` stays green with 100% direct coverage. | VERIFIED | Orchestrator ran it on this tree: green. |
| 02-01 / D-09 | An already-enabled root with a missing dependency is skipped as `{already enabled}`. | VERIFIED (unit) | `refuseMissing` is gated on `isRecordedButDisabled(installed)` at `:1412`; the unit test covers it. No scenario; no criterion requires one. |
| 02-02 | Every scenario compares whole results, records, configs, and session outcomes its title claims. | VERIFIED | Step semantics above; scenarios read in full. |
| 02-02 | The ENA-05 refusal titles say "fails". | VERIFIED | Titles at `enable.feature:202` and `disable.feature:180`. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/plugin/enable.feature` | ENA-01, -03, -04, -05, -06 scenarios | VERIFIED | 9 scenarios, all pass; table now aligned. |
| `features/plugin/disable.feature` | ENA-02, -03, -04, -05, -06 scenarios | VERIFIED | 8 scenarios, all pass. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` | Refusal of an enable over an uninstalled closure member | VERIFIED | Substantive and wired through `resolveEnableCascadeStep` into `runSetEnabledOutcome`; later `standaloneTransactionThrowReasons` keeps the refusal reason path intact. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts` | `composeEnableMissingDependencyCause` | VERIFIED | Defined at `:120`, imported and called at `enable-disable.ts:86` / `:820`. |
| `docs/output-catalog.md`, `docs/plugin-enablement.md`, `CHANGELOG.md` | Describe the refusal | VERIFIED | Catalog state `enable-refused-missing-dependency` at `output-catalog.md:4123`, with its fixture `test/architecture/catalog-uat/fixtures/plugin-enable.ts:75`. |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `runSetEnabledOutcome` | `resolveEnableCascade` | `resolveEnableCascadeStep({..., installed})`, `refuseMissing = isRecordedButDisabled(installed)` | WIRED |
| `resolveEnableCascade` | failed row | `EnableRefusedError` caught in the standalone catch; reason via `standaloneTransactionThrowReasons` | WIRED (scenario shows the row) |
| Scenarios | product | real extension in a headless Pi, JSON results | WIRED (17/17 pass) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase scenarios | `npx cucumber-js --parallel 2 features/plugin/enable.feature features/plugin/disable.feature` | 17 scenarios, 259 steps passed, exit 0 | PASS |
| Feature gate | `npm run check:features` | exit 0 | PASS |
| Full gate | `npm run check` | Orchestrator: green on this tree, 702/702 scenarios | PASS (orchestrator evidence) |

### Probe Execution

Not applicable: the phase declares no probes.

### Requirements Coverage

| Requirement | Source plan | Status | Evidence |
| --- | --- | --- | --- |
| ENA-01 | 02-02 | SATISFIED | `enable.feature:55` |
| ENA-02 | 02-02 | SATISFIED | `disable.feature:59` |
| ENA-03 | 02-02 | SATISFIED | `enable.feature:74`, `disable.feature:90` |
| ENA-04 | 02-02 | SATISFIED | `enable.feature:105`, `:136`; `disable.feature:120`, `:151` |
| ENA-05 | 02-01, 02-02 | SATISFIED (per D-01, D-02) | `enable.feature:169`, `:202`; `disable.feature:180` |
| ENA-06 | 02-02 | SATISFIED | `enable.feature:91`, `disable.feature:108` |

No orphaned requirements: REQUIREMENTS.md maps exactly ENA-01..ENA-06 to Phase 2.

### Anti-Patterns Found

None. No `TBD`, `FIXME`, or `XXX` in the covered feature, product, or messaging files. The earlier column-alignment and broken-comment findings are fixed.

### Warnings and Info

- **W-1 (carried forward):** ROADMAP Phase 2 SC-4 and REQUIREMENTS ENA-05 still say an absent dependency is "installed". The product and scenario refuse that enable (D-02, upstream `dependency_missing`). The divergence is licensed but the contract text was never amended; the orchestrating session owns those files. Not a gap, but a later audit could read the refusal as a missed criterion. Also note REQUIREMENTS.md still marks ENA-01..06 as `Pending`.
- **I-1:** SC-3 names the other scope's `list` rows. The scenarios compare the other scope's installation records, which `list` reads, rather than running `list` per scope (D-06). Equivalent.
- **I-2:** "Enabling in the user scope leaves the project scope unchanged" does not check the project scope's staged skill files. A bug that staged the skill into both scopes without touching the project record would pass. Unlikely; not a gap.
- **I-3:** D-09 has a unit test only, no scenario.

### Gaps Summary

No gaps. Every success criterion has a scenario that a plausible wrong implementation would fail, every scenario passes on the combined tree, and later phases (notably the Phase 15 lock-held classification) extended the code around this phase's behavior without changing it.

---

_Verified: 2026-10-23T10:57:55Z_
_Verifier: Claude (gsd-verifier)_

## For the orchestrator

- Doc drift (still open): ROADMAP Phase 2 SC-4 and REQUIREMENTS ENA-05 still say enable "installs" an absent dependency; per D-02 (Claude Code `dependency_missing`) enable now refuses it. Reword both to "refused when absent, as Claude Code does". REQUIREMENTS.md traceability also still shows ENA-01..06 as `Pending`.
- Product change: standalone `enable` refuses with `{dependency unsatisfied}` and cause `Install <deps> first, then enable <plugin>.` when a dependency is not installed; an already-enabled plugin still skips as `{already enabled}` (D-09). CHANGELOG has an Unreleased entry.
- Resolved: the output-catalog count conflict risk (state `enable-refused-missing-dependency` raising counts in `test/architecture/catalog-uat/catalog-{contract,parser,wire}.test.ts`) is moot now that the milestone is merged and `npm run check` is green on the combined tree.
- Resolved: the follow-up commit `4b756cf5` (comment, catalog prose, table alignment) is now covered by the full `npm run check` on the merged tree.
- Assumption: D-09 (already-enabled root plus missing dependency is skipped, not refused) has a unit test only, no cucumber scenario.
- Assumption: the "not installed" result for enable/disable is a `skipped` row at `error` severity (existing behavior); counted as "fails with the not-installed reason".
- Upstream note (not fixed, out of scope): standalone `uninstall` of a dependency that no layer declares is refused with `{dependents remain}` even when the only dependent is disabled; Claude Code 2.1.30x lets uninstall go through and reports the reverse dependents. Belongs to the uninstall phase if anyone owns it (check Phase 6 was scoped to cover it).
- Upstream note (not exercised): the enable closure may read declarations from the marketplace's current copy, whereas Claude Code reads the installed `plugin.json`.
