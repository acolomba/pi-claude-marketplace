---
phase: 09-plugin-list
verified: 2026-10-23T09:33:38Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/09-plugin-list/09-01-PLAN.md"
  - ".planning/phases/09-plugin-list/09-01-SUMMARY.md"
  - ".planning/phases/09-plugin-list/09-02-PLAN.md"
  - ".planning/phases/09-plugin-list/09-02-SUMMARY.md"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts"
  - "features/plugin/list.feature"
  - "test/orchestrators/plugin/list-flow.test.ts"
covered_digest: "v3:sha256:8bf23a34bb0b3d07088eaf43f37d41c47a56efbb6df47f3af32f1b5db82e008c"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 9: Plugin List Verification Report

**Phase Goal:** `list` has scenarios for every row status and every filter, for selecting one marketplace or one scope, and for `--remote`.
**Verified:** 2026-10-23T09:33:38Z
**Status:** passed
**Re-verification:** No (initial verification)

## Goal Achievement

The verification read the code and the scenarios directly. It did not rely on the SUMMARY claims. Each criterion was checked with one question: would a plausible wrong implementation still pass the scenario? The row step (`the result lists these plugins:`, `features/step_definitions/command.steps.ts:83`) compares the whole row set. `recordTable` adds every column that the records carry, so a table cannot leave out a row or a column. The envelope step does the same for fields. The `the git host receives no request` step asserts `{ requests: [], connections: 0 }` for the window of the last `When` command. A `github` shorthand source goes to the loopback host through the GitHub base override (`features/support/pi-process.ts`), so a request to a git host would show in that log. The no-request check is therefore not vacuous.

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
| - | --------------------------------- | ------ | -------- |
| 1 | `list` shows installed, available, unavailable, and partially available plugins, each with its status and scope, compared as one whole table (LST-01). | VERIFIED | `list.feature:7-69`: one whole table with 8 rows, each with its status and scope: `installed` (user), `upgradable`, `available`, `partially-installed`, `disabled`, `partially-available` {unsupported component}, `remote`, and `unavailable` {unsupported source} (project), with `tally success count 8`. A wrong status, a wrong scope, or a missing or extra row fails the deep-equal. `partially-upgradable` is not covered. The title was changed from "every status" to "each kind" (WR-04), and SC-1 does not ask for that status. |
| 2 | `--installed`, `--available`, `--unavailable`, and `--partial` each keep only their own rows, and two combined filters keep the union of their rows (LST-02). | VERIFIED | `list.feature:71-128` `--installed` keeps 4 rows (installed, upgradable, partially-installed, disabled), as PL-8 requires. `:130-185` `--available` keeps only `beta`, which also proves that it leaves out `partially-available`. `:187-242` `--unavailable` keeps only `npmp`. `:244-299` `--partial` keeps only `gamma` and leaves out `partially-installed` `delta` (PL-8). `:301-357` `--available --unavailable` keeps 2 rows. An intersection gives 0 rows and last-filter-wins gives 1 row, so both would fail. Every filter scenario uses the same fixture as the whole table, so each one also proves which rows are dropped. |
| 3 | `list <marketplace>` keeps only that marketplace's plugins, and an unknown marketplace fails as not added. `--scope user` and `--scope project` keep only that scope's installations (LST-03, LST-05). | VERIFIED | `:417-477` `list tools` names the marketplace that only the project scope holds and gets 7 rows, all from `tools`. An implementation that ignores the positional would also show `extras`. A presence check that looks only in the user scope would fail as not added. Both fail the scenario (CR-04 closed). `:597-607` unknown marketplace: `marketplace-not-added`, `error`, no `scope`. `:609-620` unknown marketplace with `--scope project`: `scope project`, plain `marketplace not added`. An implementation that always sets the cross-scope flag fails here (WR-01). `:622-633` with the other scope holding it: `marketplace not added to user scope`. `:479-533` `--scope user` keeps 1 row. `:535-595` `--scope project` keeps 7 rows. `:635-658` and `:660-683` cover a project installation from a marketplace that only the user scope added. Under `--scope project` it shows under its own `[project]` header. Under `--scope user` it is an `available` row. Code: `list-flow.ts` `foldsInBothScopeView` turns the orphan fold off under `--scope`, and `marketplaceAdded` uses `collectMarketplaceRecordsByScope` with `crossScopeFlag`. |
| 4 | `list --remote` reports a git-source plugin whose source has a newer revision on the git host, and `list` without the flag makes no request (LST-04). Judged as read by CONTEXT D-03. | VERIFIED (per D-03) | Claude Code has no `--remote` flag, and NFR-5 forbids network access from `list`. D-03 reads SC-4 as follows: `list --remote` reports the git-source plugin that is not yet cloned, and neither `list` nor `list --remote` sends a request to the git host. `:359-415` `list --remote` keeps only `ghp@tools (remote)` plus the empty `extras` header (D-04), and then `the git host receives no request`. `:69` plain `list` also asserts no request. An implementation that probes `ls-remote` for newer revisions would show requests or connections on the loopback host and fail. The literal "newer revision on the git host" behavior is not built and not tested. This is intentional, see "For the orchestrator". |
| 5 | The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green. | VERIFIED (`npm run check` checked by the orchestrator) | `npx cucumber-js features/plugin/list.feature`: 15 scenarios, 250 steps, all passed, exit 0. `npm run check:features`: exit 0. `node --test test/orchestrators/plugin/list-flow.test.ts`: 100 tests passed, 0 failed. The full `npm run check` includes `test:cucumber` and direct coverage, and the orchestrating session runs it separately, so this verifier did not run it. |

**Score:** 5/5 truths verified (0 present but behavior-unverified)

### Plan must-haves (merged)

| Plan truth | Status | Note |
| ---------- | ------ | ---- |
| 09-01: not-added result, `scope` only under `--scope`, cross-scope reason | VERIFIED | Unit cases `PL-3: a marketplace neither scope records…` and `…only the other scope records…` give exact rendered messages. Scenarios `:597-633` also cover it. |
| 09-01: folded project installation "under the user header" under `--scope project` | VERIFIED as amended | Superseded by the D-02 amendment after review CR-01..CR-03. Under `--scope`, the clone is its own `[project]` block. Unit tests and the scenario at `:635-658` pin the amended behavior. |
| 09-01: output without `--scope` unchanged | VERIFIED | The fold is gated on `opts.scope === undefined`. With no scope, the narrowing branch is unchanged. All pre-existing unit cases pass (100/100). |
| 09-01: 100% direct coverage of `list-flow.ts` | Checked by the orchestrator | Part of `npm run check` (`test:coverage:direct:all`). |
| 09-02: LST-01..LST-05 scenarios; cucumber and check:features pass | VERIFIED | See rows 1-5. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `features/plugin/list.feature` | Plugin list scenarios | VERIFIED | 15 scenarios. Uses only Phase 1 steps, with no list step module (D-10). |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts` | not-added failure; scope narrowing | VERIFIED | `marketplaceAdded` and the `marketplace-not-added` arm in `listPlugins`. `foldsInBothScopeView` gates both fold sites. |
| `test/orchestrators/plugin/list-flow.test.ts` | unit cases for both fixes | VERIFIED | 6 new cases with exact notifications, including the CR-02 `⊘ mp1 [project] (failed)` header. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `listPlugins` | `collectMarketplaceRecordsByScope` + `crossScopeFlag` | the same presence test `plugin info` uses | WIRED | Both are imported and called in `listPlugins` and `marketplaceAdded`. |
| `loadPluginListPayload` | orphan fold | `foldsInBothScopeView(opts, …)` | WIRED | It is used at the project-loop skip and at the user-loop fold. |

### Data-Flow Trace (Level 4)

Not applicable. This is a CLI notification surface, and the scenarios check the real emitted JSON payload end to end in a headless Pi.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase scenarios | `npx cucumber-js features/plugin/list.feature` | 15 scenarios / 250 steps passed, exit 0 | PASS |
| Feature gate | `npm run check:features` | exit 0 | PASS |
| Unit pair | `node --test test/orchestrators/plugin/list-flow.test.ts` | 100 pass, 0 fail | PASS |
| Full gate | `npm run check` | exit 0 at 980624c9 (478/478 scenarios, direct coverage complete), run by the phase session | PASS |

### Probe Execution

None declared. Step 7c does not apply.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| LST-01 | 09-02 | statuses with scope | SATISFIED | Truth 1 |
| LST-02 | 09-02 | filters and union | SATISFIED | Truth 2 |
| LST-03 | 09-01, 09-02 | marketplace positional, not added | SATISFIED | Truth 3 |
| LST-04 | 09-02 | `--remote`, no request | SATISFIED (per D-03) | Truth 4 |
| LST-05 | 09-01, 09-02 | scope filter on installations | SATISFIED | Truth 3 |

No orphaned requirements. REQUIREMENTS.md maps only LST-01..LST-05 to Phase 9.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `features/plugin/list.feature` | 8-49, 72-113, … (10 copies) | The same 42-line fixture is copied into each shared-fixture scenario (review WR-03) | Warning | Readability and maintenance only. Each copy is identical, and the scenarios still prove their behavior. |
| `list-flow.ts` / `plugin/info.ts` / `marketplace/info.ts` | — | The not-added message literal is built in three places (review IN-01) | Info | Duplication only. |

No `TBD`/`FIXME`/`XXX`/`TODO` markers in the changed files.

### Human Verification Required

None.

### Gaps Summary

None block the goal. Every criterion is proved by a scenario that a plausible wrong implementation fails. The four Critical review findings (CR-01..CR-04) were fixed in `c7eac1fc`, and the code and scenarios confirm it. SC-4 is met as CONTEXT D-03 reads it, not literally. See below.

## For the orchestrator

- Deviation (SC-4): ROADMAP SC-4 and LST-04 say "newer revision on the git host". Per CONTEXT D-03, Claude Code has no such flag and NFR-5 forbids network access from `list`. So `list --remote` is verified as the RSTA-07 filter for a not-yet-cloned git-source plugin, and the scenarios prove that neither `list` nor `list --remote` sends a git-host request. Consider rewording SC-4 and LST-04 in ROADMAP.md and REQUIREMENTS.md to match.
- Deviation (09-01 must-have 2): CONTEXT D-02 was amended after review CR-01..CR-03. Under `--scope`, a project clone of a user marketplace is its own `[project]` block (no fold), and under `--scope user` a project-only installation is an `available` row. The plan text "under the user header" is superseded.
- `npm run check` passed at 980624c9 in the phase worktree (run by the phase session; 478/478 scenarios, direct coverage complete).
- Tech debt (WR-03): the 42-line fixture is copied into 10 scenarios. The fix was skipped because splitting into `features/plugin/list-filters.feature` with a `Background:` is outside the phase's file ownership (only `features/plugin/list.feature`).
- Tech debt (IN-01): the `marketplace-not-added` builder is duplicated in three places (`list-flow.ts`, `plugin/info.ts`, `marketplace/info.ts`). It could move to `orchestrators/marketplace/shared.ts` next to `crossScopeFlag`.
- Deferred (IN-03): `docs/output-catalog.md` (not-added triggers, plugin-list `--scope` rule), PRD PL-3 (unknown marketplace now fails), and `CHANGELOG.md` are not updated for the two list behavior changes: not-added for `list <marketplace>`, and per-scope blocks under `--scope`.
- Coverage note: no scenario has a `partially-upgradable` row. SC-1 does not require one, and the scenario title was narrowed (WR-04).
- Assumption: D-01 keeps the LLM tool and the browser loader without the not-added check. The WR-02 tool output change (clone listed under `(project)`) was not re-verified here beyond the shared payload builder.

---

_Verified: 2026-10-23T09:33:38Z_
_Verifier: Claude (gsd-verifier)_
