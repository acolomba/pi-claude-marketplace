---
phase: 07-plugin-update-by-marketplace-constraint-and-partial
verified: 2026-10-23T04:56:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/07-plugin-update-by-marketplace-constraint-and-partial/07-01-PLAN.md
  - .planning/phases/07-plugin-update-by-marketplace-constraint-and-partial/07-01-SUMMARY.md
  - features/plugin/update.feature
covered_digest: "v3:sha256:6953b190ea0b78852225248bc0cba460b7ea8cf8df4e23838a1c2638744886a7"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 7: Plugin Update by Marketplace, Constraint, and Partial Verification Report

**Phase Goal:** `update` has scenarios for updating every plugin of one marketplace, for a version constraint that blocks an update, and for a new version that became partially available.
**Verified:** 2026-10-23
**Status:** passed. This depends on the orchestrator's `npm run check` result (see "For the orchestrator").
**Re-verification:** Yes. The earlier report had no gaps. Only its covered digest was stale, because the "For the orchestrator" wording of `07-01-SUMMARY.md` was corrected. I re-ran the evidence and recomputed the digest.

## Scope

The deliverable is the 7 scenarios at `features/plugin/update.feature:243-424`, from "Updating the plugins of one marketplace updates each outdated plugin of that marketplace only" to the end of the file. Commit `e6d28453` adds them. It touches only `update.feature` and `07-CONTEXT.md`. No step module was added (D-01), and `git diff 0fc0172c HEAD --stat` shows no change outside the feature file and the phase directory.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC-1 / UPD-01: `update @<marketplace>` updates every outdated plugin of that marketplace and reports each move. The outdated plugins of another marketplace keep their installed versions. | VERIFIED | `update.feature:243-280`. `demo` and `pp` of `fixtures` and `app` of `tools` are all outdated. The run is `update @fixtures`. The whole fields table includes tally success count 2. The rows list exactly `demo` and `pp` as `updated` 1.0.0 -> 1.1.0. The installation record holds `app@tools 1.0.0` and both fixtures plugins at 1.1.0. |
| 2 | SC-2 / UPD-03: an update whose new version breaks a dependency's version constraint is blocked with its reason. The installed versions, records, and offered skills stay unchanged. | VERIFIED | `update.feature:308-339`. `app` declares `lib@^1.0.0`, and the marketplace then offers `lib` 2.0.0. The run is `update lib@tools`. The row is `skipped` with the reason `dependents constrain` and the full cause chain `(>=1.0.0 <2.0.0-0) -- required by "app@tools"`. The record keeps `lib@tools 1.0.0`. A new session offers the 1.0.0 skills of `app`, `demo`, and `lib`. The sibling scenario at `:282-306` shows that an in-range `lib` 1.1.0 goes through, so a gate that holds every ranged dependency fails it. |
| 3 | SC-3 / UPD-05: `update --partial` updates a plugin whose new version became partially available, and `info` names what was left out. Without the flag, the update fails and the installed version stays. | VERIFIED | Without the flag (`:341-361`): a `partially-upgradable` row with `unsupported component` and the hint `partial-update`. The record keeps 1.0.0, and the session keeps the 1.0.0 skill. With `--partial` (`:363-382`): a `partially-installed` row at 1.1.0. The record holds 1.1.0, and the session offers the 1.1.0 skill. `list` (`:407-424`) reads the saved partial state. `info` (`:384-405`) returns the whole `plugin-info` result: `partially-installed`, 1.1.0, `unsupported component`, and skill `demo-skill`. See notes N-1 and N-2 on "fails" and "names". |
| 4 | SC-4: the phase's scenarios pass in cucumber, and `npm run check:features` and `npm run check` stay green. | VERIFIED (cucumber and check:features). `npm run check` is the orchestrator's. | I ran `npx cucumber-js features/plugin/update.feature --parallel 2`: 16 scenarios and 225 steps passed (exit 0, random order). A first run at the default `parallel 8` failed all 16 scenarios on step timeouts, while the host load average was about 96 from other worktrees' checks. The same file passed once the load was lower, so this is load, not the scenarios. I ran `npm run check:features`: exit 0, no findings. By instruction, I did not run `npm run check`. |
| 5 | Plan truth: every table compares the whole result, record, or session, and no table lists a sample. | VERIFIED | `command.steps.ts:75-88`: `namesLike` and `recordTable` add every unstated field or column, so a missing or extra field fails. `lastResult()` (`world.ts:168`) requires exactly one payload. The record step (`installation.steps.ts:202-211`) and the skills step (`session.steps.ts:49-52`) compare the whole sorted set. The `After` hook fails when rows or session results go uncompared, so the sessions in `:334`, `:358`, and `:379` must have reported no results. |

**Score:** 5/5 truths verified (0 present but behavior-unverified). The truths are behavioral tests, and they all passed in my own run.

### Would a plausible wrong implementation pass? (cucumber review question)

| Wrong implementation | Caught by |
| --- | --- |
| `@fixtures` ignored, so every marketplace is updated | UPD-01 rows (an extra `app` row) and the record (`app@tools 1.1.0`) |
| The marketplace filter drops plugins, or the update reports but does not persist | UPD-01 tally and rows, and the record versions |
| The constraint gate is missing, so `lib` moves to 2.0.0 | UPD-03 row, record, and session |
| The gate holds every dependency that has any range | the in-range sibling scenario (`updated`, record `lib@tools 1.1.0`) |
| A wrong caret expansion | the pinned cause-chain text `>=1.0.0 <2.0.0-0` |
| The partial gate is skipped without `--partial`, or runs after a bridge commit | the status and hint, and the 1.0.0 session skill |
| A `--partial` swap writes the record but leaves the old skill staged, or drops the skills | the 1.1.0 session skill check (`:379-382`) |
| A `--partial` swap saves an empty `compatibility.unsupported` | the `list` scenario (`partially-installed` from the record) |
| The decline severity changes (warning to error, or warning to info) | the whole fields tables |

Remaining weakness (Info, not blocking): the UPD-01 scenario has no new-session skill check. A `@marketplace` path that writes the 1.1.0 records but does not restage the skills would pass it. The single-plugin scenario at `:28-36` covers restaging for the per-plugin swap. The `@marketplace` path reaches the same swap, so this is defense in depth, not a gap in the success criterion (review IN-01).

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/plugin/update.feature` | the new update scenarios | VERIFIED | 7 new scenarios (`git diff 0fc0172c HEAD` counts 7 `+  Scenario:` lines). The file contains `/claude:plugin update @fixtures --scope project`. All scenarios pass. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `update.feature` | `features/step_definitions/plugin/publishing.steps.ts` | `the published plugin {string} of the marketplace {string} has an output style` | WIRED | Step defined at `publishing.steps.ts:90`. It is used at `:345`, `:367`, `:388`, and `:411`, and `check:features` reports no undefined or ambiguous step. |

### Data-Flow Trace (Level 4)

Not applicable. The deliverable is test scenarios, and its "data" is the product's JSON results, which the steps compare whole.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| The phase scenarios pass | `npx cucumber-js features/plugin/update.feature --parallel 2` | 16 scenarios and 225 steps passed, exit 0 (the default parallel 8 run timed out under host load 96) | PASS |
| Layout and feature rules; no unused, undefined, or ambiguous step | `npm run check:features` | exit 0, no output findings | PASS |
| Full gate | `npm run check` | exit 0; cucumber 470 scenarios / 4503 steps passed, direct coverage merged (run by the phase session at commit 320683bf) | PASS |

### Probe Execution

None declared. This is not a migration or tooling phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| UPD-01 | 07-01 | `update @<marketplace>` updates every outdated plugin of that marketplace and leaves other marketplaces' plugins unchanged | SATISFIED | Truth 1 |
| UPD-03 | 07-01 | A dependency whose version constraint the new version breaks blocks the update and changes nothing | SATISFIED | Truth 2. See N-3 on the wording. |
| UPD-05 | 07-01 | `update --partial` updates a partially available new version, and the update fails without the flag | SATISFIED | Truth 3 |

There are no orphaned requirements. REQUIREMENTS.md maps only UPD-01, UPD-03, and UPD-05 to Phase 7.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `features/plugin/update.feature` | 282-339 | The Background installs `demo`, which the two constraint scenarios do not need (`rules/features.md`). Review WR-05 skipped it because of file ownership. | Warning | Readability only. `demo` appears in their record and skill tables, so nothing is hidden. Several older scenarios in the file already break the same rule. |
| `features/plugin/update.feature` | 243-280 | No session skill check for the `@marketplace` path (IN-01) | Info | Defense in depth; see above |

There are no TBD, FIXME, or XXX markers and no placeholders.

### Notes on success-criterion wording

- **N-1 ("fails" without `--partial`):** the result is a `warning` with `partially-upgradable`, not an `error`. D-10 records this as the SEV-04 / XSURF-03 split. `XSURF-03` appears in `orchestrators/types.ts:402` and `orchestrators/plugin/update.messaging.ts:14`. The update does not happen and the installed version stays, which is the behavior SC-3 asks for. The title says "is held", which matches the result.
- **N-2 ("info names what was left out"):** `info` names the reason class `unsupported component`, not "output style". The product cannot say more. The reason vocabulary (`shared/notification-types.ts:22-24, 240`) has only `unsupported component`, `unsupported hooks`, and `unsupported mcp`, and `info.ts` builds reasons through `narrowUnsupportedKinds`. The whole-field comparison proves that the JSON result has no field that lists component kinds. If the user wants "output style" named, that is a product change, not a gap in the scenarios.
- **N-3 (UPD-03 direction):** UPD-03 says a dependency "whose version constraint the new version breaks". That fits the tested case: the declared `lib@^1.0.0` entry is broken by `lib` 2.0.0. SC-2 is more ambiguous. The other direction is a new version that needs a newer dependency than the one installed. D-05 deliberately leaves it to the LOAD-01 load-time check and defers it to Phase 11. The SUMMARY raises a rewording as IN-02.

### Human Verification Required

None.

### Gaps Summary

No gaps. All three behaviors have scenarios that compare whole results, records, and sessions. Each scenario fails under the plausible wrong implementations listed above, and every scenario passes. The earlier documentation inaccuracy (SUMMARY said 8 scenarios in all) is corrected: SUMMARY now says 7, which matches the diff.

## For the orchestrator

Carried from `07-01-SUMMARY.md`:

- No shared GSD file was changed or committed. This verification edited only this file.
- After the code review (07-REVIEW-FIX.md), the phase has **7** new scenarios. The SUMMARY now says 7 in all, which is correct; 16 is the file total. The review added the in-range dependency update and the `list` after `--partial`. It added new-session skill checks to both `--partial` scenarios. Two titles changed.
- **IN-02:** UPD-03 and SC-2 can read as if the update's own new version broke a dependency's range. The scenarios cover the gated direction: a dependent's range holds a dependency's new version (D-04). Consider rewording UPD-03 and SC-2 to match (see N-3).
- **IN-03:** a `partially-installed` update row carries `version` but no `from`/`to`, unlike an `updated` row. This is product grammar to weigh, not a defect in the scenarios.
- **WR-05:** the constraint scenarios sit under a Background whose `demo` they do not need. Moving them to a dependency feature file would cross file ownership. Record it as a follow-up if wanted.
- **D-05** defers a scenario for a new version that needs a newer dependency (enforced at load by LOAD-01) to the reconcile coverage (Phase 11). I checked: Phase 11's ROADMAP success criteria (`ROADMAP.md:319-331`) do not name this case, and no other phase or Carried Forward entry does. The deferral has no carrier yet. Add it to Phase 11's criteria or to BACKLOG.md. This is not a Phase 7 gap, because D-05 puts the case out of Phase 7's scope.
- **`npm run check`:** I did not run it, by instruction. The `passed` status depends on it. If your parallel run is red because of this phase's files, change the status to `gaps_found`.
- Optional hardening (IN-01): add a new-session skill check to the UPD-01 scenario.

---

_Verified: 2026-10-23_
_Verifier: Claude (gsd-verifier)_

## Gate result

`npm run check` was run on the phase tree at commit `320683bf` and exited 0. The cucumber suite passed 470 scenarios and 4503 steps, and the direct-coverage LCOV merged 280 records. SC-4 is met in full.
