---
phase: 02-plugin-enable-and-disable
verified: 2026-10-23T09:33:11Z
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
covered_digest: "v3:sha256:1f918977c6eb60033128df5f4fed30616e4cc416a6e2a759d0821f1687db885a"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Confirm the orchestrator's `npm run check` on HEAD 9b58305c exits 0 (read the exit code, not a piped tail)."
    expected: "Exit 0: typecheck, lint, fallow, format, check:features, test:corresponding, test:unpaired, test:integration, and direct coverage of every source-test pair all green."
    why_human: "The verifier was told not to run `npm run check` because another process was running it. It is the remaining clause of SC-5 and of plan 02-01's must-have. If it is green, every must-have is verified and the status is `passed`; if it is red, the status is `gaps_found`."
---

# Phase 2: Plugin Enable and Disable Verification Report

**Phase goal:** `enable` and `disable` have scenarios for every lifecycle behavior: skills come and go across sessions while the plugin stays installed, a no-op is skipped, each scope changes alone, dependencies behave as in Claude Code, and a plugin that is not installed fails.
**Verified:** 2026-10-23T09:33:11Z, at HEAD `9b58305c`
**Status:** human_needed (one pending gate result, no gaps)
**Re-verification:** No, initial verification

## Method

Goal-backward. For each success criterion I read the scenarios in `features/plugin/enable.feature` and `features/plugin/disable.feature` and the step definitions they use, and asked whether a plausible wrong implementation would still pass. The step semantics matter for that question:

- `the result has these fields:` and `the result lists these plugins:` compare the whole envelope and every row. A column the table leaves out is appended by `namesLike`, so an extra field fails the step (`features/lib/field-rows.ts`).
- `the "<file>" file of the <scope> scope declares these plugins:` compares every declaration and every field of each entry. A table with only an `id` column asserts the entry is `{}`, with no `enabled` key.
- `the installation record of the <scope> scope holds these plugins:` compares the whole sorted set of `(id, version, enabled)`, so a second or missing record fails.
- `the session offers these skills:` / `offers no skills` compare the whole skill list of a real new Pi session. The world's `After` hook fails a scenario whose session results or rows go uncompared (`features/support/world.ts`), so a session that silently reconciled something would fail too.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | After `disable`, a new session offers none of the plugin's skills and `list` shows it installed and disabled. After `enable`, a new session offers its skills again and the scope holds exactly one installation record (ENA-01, ENA-02). | VERIFIED | `disable.feature` "Disabling an enabled plugin offers none of its skills and keeps it installed": `disabled` row, record `enabled false`, config `enabled false`, a `list --scope project` with full envelope (tally success count 1) and a `disabled` row with version, then `session offers no skills`. `enable.feature` "Enabling a disabled plugin offers its skills again and keeps one installation record": `installed` row, record set is exactly `demo@fixtures 1.0.0 true`, session offers `/skill:demo-skill`. A disable that uninstalls fails the record and `list` steps; an enable that flips the flag without restaging fails the session step; a duplicate record fails the whole-set record step. |
| 2 | Enabling an enabled plugin and disabling a disabled one report a skipped row with the matching no-op reason. Enable and disable of a plugin that is not installed fail with the not-installed reason (ENA-03, ENA-06). | VERIFIED | "Enabling an enabled plugin is skipped as already enabled" and "Disabling a disabled plugin is skipped as already disabled": `skipped` rows with `already enabled` / `already disabled`, `needs reload false`, records and configs unchanged. "Enabling/Disabling a plugin that is not installed fails as not installed": `severity error`, summary `A plugin operation has failed.`, row reason `not installed`, config declares no plugins (enable also checks the session offers no skills). A re-materializing no-op fails on `needs reload` and the row status; an enable that installs fails the config step. |
| 3 | With `--scope user` and with `--scope project`, enable and disable change only the named scope (ENA-04). | VERIFIED | Four scenarios (D-06). Each installs `demo` in both scopes, changes one, and checks both scopes' installation records and both base configs. Offered skills are told apart with a session in the project (both scopes) and a session in another project (user scope only): enable-user checks the user-only session offers the skill; enable-project checks the project session offers it and the user-only session offers none; disable-user checks the project session still offers it and the user-only session offers none; disable-project checks the user-only session still offers it. A command that resolves the wrong scope root, or writes both scopes, fails a record, config, or session step. See Info I-1 for the `list` wording. |
| 4 | Enabling a plugin whose dependencies are disabled or absent enables or installs them and reports each one. Disabling a plugin that an enabled plugin depends on is refused or cascaded as Claude Code's `/plugin` does, and the title says which (ENA-05). | VERIFIED (per D-02) | Disabled dependency: "Enabling a plugin enables its disabled dependency too": two rows (`app` installed, `lib@tools` installed `{dependency enabled}`), both records `true`, both config entries `true`, both skills offered. Absent dependency: "Enabling a plugin whose dependency is not installed fails as dependency unsatisfied": `failed` row, reason `dependency unsatisfied`, cause `Install lib@tools first, then enable app@tools.`, record and config stay `false`, no skills offered. The absent dependency is reached through user commands only (D-05). Disable: "Disabling a plugin that an enabled plugin depends on fails as dependents remain": `failed` row `{dependents remain}`, both records stay `true`, both skills still offered. Both refusals say "fails" in the title. The absent-dependency arm deviates from the ROADMAP words "or installs them" under D-02. I re-checked the upstream evidence in the installed Claude Code 2.1.309 binary: `enable` returns `failureCode:"dependency_missing"` with `<name> depends on <deps>, which is not installed. Install it first`, and `disable` returns `failureCode:"required_by_dependents"`. Under the project's upstream-parity constraint, the refusal is the correct behavior. See Warning W-2. |
| 5 | The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green. | PARTIAL, pending evidence | `npx cucumber-js features/plugin/enable.feature features/plugin/disable.feature`: 17 scenarios, 259 steps, all passed, exit 0 (run by the verifier). `npm run check:features`: exit 0 (run by the verifier). `node --test` on both enable-disable unit test files: 209 pass, 0 fail (run by the verifier). `npm run check`: run by the orchestrator, result not yet received. This is the only human-verification item. |

**Score:** 4/5 fully verified by the verifier; the fifth is verified except for the `npm run check` clause, which the orchestrator holds. 0 present-but-behavior-unverified.

### Plan must-haves

| Plan | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 02-01 | An `enable` whose closure holds an uninstalled member is refused with `{dependency unsatisfied}` and an install-first cause, and nothing changes. | VERIFIED | `resolveEnableCascade` collects members with no record into `missing` and throws `EnableRefusedError("dependency unsatisfied", composeEnableMissingDependencyCause(...))` inside the locked transaction, before any phase runs. The cucumber scenario checks record, config, and session; unit tests compare the whole state file text, including a missing member two edges away. |
| 02-01 | A closure whose members are all installed behaves as before (`{dependency enabled}` / `{already enabled}`). | VERIFIED | The disabled-dependency scenario above, plus the existing unit tests (209 pass). |
| 02-01 | The `not-installed` disposition and its warning skip row are gone, with no unreachable branch. | VERIFIED | `EnableCascadeDisposition` is `"re-enabled" \| "already-enabled"`; `record` is required; `enableCascadeSkipRow` has one arm. |
| 02-01 | `npm run check` stays green with 100% direct coverage. | PENDING | Orchestrator evidence (see Human Verification). |
| 02-01 / D-09 | An already-enabled root with a missing dependency is skipped as `{already enabled}`, as upstream answers `already_in_goal_state` first. | VERIFIED (unit) | `refuseMissing` is `isRecordedButDisabled(installed)`; unit test "EDEP-01: an enabled root with a missing dependency is skipped as already enabled" passes. No scenario covers it; the ROADMAP does not require one. |
| 02-02 | Every scenario compares whole results, records, configs, and session outcomes the title claims. | VERIFIED | Step semantics above; every new scenario states fields, rows, records, and configs; titles that claim skills check the session. |
| 02-02 | The ENA-05 refusal titles say "fails". | VERIFIED | "...fails as dependency unsatisfied", "...fails as dependents remain". |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/plugin/enable.feature` | ENA-01, -03, -04, -05 (enable), -06 scenarios | VERIFIED | 9 scenarios (2 pre-existing layer scenarios, the pre-existing ENA-01 scenario, 6 new). `verify.artifacts` passed. |
| `features/plugin/disable.feature` | ENA-02, -03, -04, -05 (disable), -06 scenarios | VERIFIED | 8 scenarios (2 pre-existing layer scenarios, 6 new). `verify.artifacts` passed. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` | Refusal of an enable over an uninstalled closure member | VERIFIED | Contains `dependency unsatisfied`; wired through `resolveEnableCascadeStep` -> `runSetEnabledOutcome`. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts` | `composeEnableMissingDependencyCause` | VERIFIED | Imported and called by `resolveEnableCascade`; covered by a messaging unit test. |
| `docs/output-catalog.md`, `docs/plugin-enablement.md`, `CHANGELOG.md` | Describe the refusal | VERIFIED | New catalog state `enable-refused-missing-dependency` with its fixture; the divergence section names the standalone/reload split. See Info I-3. |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `runSetEnabledOutcome` | `resolveEnableCascade` | `resolveEnableCascadeStep({..., installed})`, `refuseMissing = isRecordedButDisabled(installed)` | WIRED |
| `resolveEnableCascade` | failed row | `EnableRefusedError` caught and classified in the standalone catch of `runSetEnabledOutcome` | WIRED (scenario shows the row) |
| Scenarios | product | real extension in a headless Pi, JSON results | WIRED (17/17 pass) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase scenarios | `npx cucumber-js features/plugin/enable.feature features/plugin/disable.feature` | 17 scenarios, 259 steps passed, exit 0 | PASS |
| Feature gate | `npm run check:features` | exit 0 | PASS |
| Enable/disable unit tests | `node --test test/orchestrators/plugin/enable-disable.test.ts test/orchestrators/plugin/enable-disable.messaging.test.ts` | 209 pass, 0 fail | PASS |
| Upstream evidence for D-01/D-02 | `grep -a` on the Claude Code 2.1.309 binary | `failureCode:"dependency_missing"` with "which is not installed. Install it first"; `failureCode:"required_by_dependents"` | PASS |
| Full gate | `npm run check` | run by orchestrator | PENDING |

### Probe Execution

Not applicable: the phase declares no probes.

### Requirements Coverage

| Requirement | Source plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| ENA-01 | 02-02 | Enabling a disabled plugin makes a new session offer its skills again and keeps one installation record | SATISFIED | `enable.feature`: "Enabling a disabled plugin offers its skills again and keeps one installation record" |
| ENA-02 | 02-02 | Disabling an enabled plugin makes a new session offer none of its skills and keeps it installed (`list` shows it disabled) | SATISFIED | `disable.feature`: "Disabling an enabled plugin offers none of its skills and keeps it installed" |
| ENA-03 | 02-02 | Enabling an enabled plugin, and disabling a disabled one, is skipped as a no-op with the matching reason | SATISFIED | "Enabling an enabled plugin is skipped as already enabled"; "Disabling a disabled plugin is skipped as already disabled" |
| ENA-04 | 02-02 | Enable and disable work in the user and project scopes, each changing only the named scope | SATISFIED | "Enabling in the user scope leaves the project scope unchanged"; "Enabling in the project scope leaves the user scope unchanged"; "Disabling in the user scope leaves the project scope unchanged"; "Disabling in the project scope leaves the user scope unchanged" |
| ENA-05 | 02-01, 02-02 | Dependencies: enable turns on disabled ones; absent ones per Claude Code; disable while an enabled plugin depends on the target matches upstream | SATISFIED (per D-01, D-02) | "Enabling a plugin enables its disabled dependency too"; "Enabling a plugin whose dependency is not installed fails as dependency unsatisfied"; "Disabling a plugin that an enabled plugin depends on fails as dependents remain". Product fix in `enable-disable.ts` (commits 96464a2b, 937c79ed). |
| ENA-06 | 02-02 | Enable and disable of a plugin that is not installed fail with the not-installed reason | SATISFIED | "Enabling a plugin that is not installed fails as not installed"; "Disabling a plugin that is not installed fails as not installed" |

No orphaned requirements: REQUIREMENTS.md maps exactly ENA-01..ENA-06 to Phase 2, and the plans claim all six.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (all phase files) | - | `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` added | none found | - |
| `features/plugin/enable.feature` | 220-221 | The `cause chain` column is not aligned: the header cell is padded for the old cause text, and the row's cell (`Install lib@tools first, then enable app@tools.`) is 7 characters wider. Introduced by the review fix IN-01. | Warning (W-1) | Cucumber rule "Align the columns" (`.agents/skills/cucumber/rules/features.md`). `check:features` does not catch it. Readability only. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` | ~2562-2563 | The catch-site comment breaks mid-sentence (`// marketplace) is the one`) after an inserted phrase. | Info | Cosmetic. |

### Warnings

- **W-1:** Unaligned table at `features/plugin/enable.feature:220-221` (see above). Fix by re-padding the `cause chain` header and its row.
- **W-2:** ROADMAP Phase 2 SC-4 still says an absent dependency is "installed", and REQUIREMENTS ENA-05 says "enables or installs them". The product and the scenario now refuse that enable (D-02), backed by the upstream `dependency_missing` code I confirmed in the 2.1.309 binary. The divergence from the wording is licensed by the upstream-parity constraint and recorded in 02-CONTEXT.md, but the contract text itself was not amended. Recommend the orchestrator amend SC-4 and ENA-05 to "refused when absent, as Claude Code does" when it closes the phase, so a later audit does not read the refusal as a missed criterion.

### Info

- **I-1:** SC-3 names "the other scope's `list` rows". The scenarios compare the other scope's installation records, which are what `list` reads, rather than running `list` per scope (D-06). I judge this equivalent.
- **I-2:** "Enabling in the user scope leaves the project scope unchanged" does not check a session in the project directory. A project session would offer the user scope's skill either way, so it cannot tell the scopes apart. The project scope's unchanged record and config are checked, but its staged skill files are not (the `the <scope> scope stages these skills and prompts:` step exists and is unused here). A bug that stages the skill into both scopes without touching the project record would pass. This is unlikely, so not a gap.
- **I-3:** The new `docs/output-catalog.md` state says the missing dependencies in the cause are "sorted and comma-joined". `renderDependentKeys` joins them in closure post-order and does not sort. With one missing member, as in every current test, the output is the same.
- **I-4:** D-09 (an already-enabled root with a missing dependency is skipped) is covered by a unit test only, not a scenario. No success criterion asks for it.

### Human Verification Required

#### 1. Full gate result

**Test:** Confirm the orchestrator's `npm run check` on HEAD `9b58305c` exits 0. Read the exit code directly; a piped tail can hide a failure.
**Expected:** Exit 0.
**Why human:** The verifier was told not to run it while another process was running it. It is the last clause of SC-5. If it is green, the phase passes; if it is red, record the failure as a gap.

### Gaps Summary

No gaps. Every success criterion has a scenario that a plausible wrong implementation would fail, and every scenario passes. The only open item is the orchestrator's `npm run check` result. Two warnings (an unaligned table and the ROADMAP/REQUIREMENTS wording that predates D-02) need cleanup but do not block the goal.

---

_Verified: 2026-10-23T09:33:11Z_
_Verifier: Claude (gsd-verifier)_


## Orchestrator evidence (2026-10-23)

- `npm run check` on HEAD `9b58305c`: exit 0 (static checks, unpaired, integration, 475 cucumber scenarios, direct coverage). SC-5 is fully verified, so the status moves from `human_needed` to `passed`.
- W-1 (column alignment), the catalog's "sorted" wording, and the broken comment are fixed in a follow-up commit.
- W-2 (ROADMAP SC-4 and REQUIREMENTS ENA-05 still say an absent dependency is installed) is left to the orchestrating session, which owns those files; D-02 records the divergence.

## For the orchestrator

- Doc drift: ROADMAP Phase 2 SC-4 and REQUIREMENTS ENA-05 still say enable "installs" an absent dependency; per D-02 (Claude Code `dependency_missing`) enable now refuses it. Reword both to "refused when absent, as Claude Code does".
- Product change: standalone `enable` refuses with `{dependency unsatisfied}` and cause `Install <deps> first, then enable <plugin>.` when a dependency is not installed; an already-enabled plugin still skips as `{already enabled}` (D-09). CHANGELOG has an Unreleased entry.
- Merge conflict risk: a new output-catalog state `enable-refused-missing-dependency` raised the counts in `test/architecture/catalog-uat/catalog-{contract,parser,wire}.test.ts` (states 290→291, presented 300→301, catalog bytes 46_623→46_792); other phases adding catalog states will conflict and need the counts re-summed.
- Assumption: D-09 (already-enabled root plus missing dependency is skipped, not refused) has a unit test only, no cucumber scenario.
- Assumption: the "not installed" result for enable/disable is a `skipped` row at `error` severity (existing behavior); counted as "fails with the not-installed reason".
- Upstream note (not fixed, out of scope): standalone `uninstall` of a dependency that no layer declares is refused with `{dependents remain}` even when the only dependent is disabled; Claude Code 2.1.30x lets uninstall go through and reports the reverse dependents. Belongs to Phase 6 (uninstall) if anyone owns it.
- Upstream note (not exercised): the enable closure may read declarations from the marketplace's current copy, whereas Claude Code reads the installed `plugin.json`.
- Skipped check: the final follow-up commit `4b756cf5` (a comment, catalog prose, table alignment) was covered by the commit hook's `check:commit`, the catalog tests and the feature run, not by a second full `npm run check`.
