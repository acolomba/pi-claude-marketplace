---
phase: 08-marketplace-help-and-usage-errors
verified: 2026-10-20T15:00:00Z
status: passed
score: 12/12 must-haves verified
covered_files:
  - ".planning/phases/08-marketplace-help-and-usage-errors/08-01-PLAN.md"
  - ".planning/phases/08-marketplace-help-and-usage-errors/08-01-SUMMARY.md"
  - ".planning/phases/08-marketplace-help-and-usage-errors/08-02-PLAN.md"
  - ".planning/phases/08-marketplace-help-and-usage-errors/08-02-SUMMARY.md"
  - ".planning/phases/08-marketplace-help-and-usage-errors/08-03-PLAN.md"
  - ".planning/phases/08-marketplace-help-and-usage-errors/08-03-SUMMARY.md"
  - ".planning/phases/08-marketplace-help-and-usage-errors/08-04-PLAN.md"
  - ".planning/phases/08-marketplace-help-and-usage-errors/08-04-SUMMARY.md"
  - ".planning/phases/08-marketplace-help-and-usage-errors/08-05-PLAN.md"
  - ".planning/phases/08-marketplace-help-and-usage-errors/08-05-SUMMARY.md"
  - "extensions/pi-claude-marketplace/edge/args-schema.ts"
  - "extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts"
  - "extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts"
  - "extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts"
  - "extensions/pi-claude-marketplace/edge/router.ts"
  - "features/marketplace/help.feature"
  - "features/marketplace/usage-errors.feature"
  - "features/plugin/usage-errors.feature"
  - "tests/edge/args-schema.test.ts"
  - "tests/edge/handlers/marketplace/shared.test.ts"
  - "tests/edge/handlers/plugin/shared.test.ts"
  - "tests/edge/router.test.ts"
covered_digest: "v3:sha256:4bff63db279ed81903f7f546e9dbcb132fb4cbb54b2179b1da21d1e39324cf16"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 8: Marketplace Help and Usage Errors Verification Report

**Phase Goal:** `marketplace help` and every usage rejection across the marketplace verbs have scenarios that compare the whole `usage-info` or `usage-error` payload.
**Verified:** 2026-10-20T15:00:00Z
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

Roadmap success criteria (the contract) plus the CONTEXT decisions and plan truths.

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | SC-1: `marketplace help` and `help marketplace` show the marketplace usage; `marketplace help` with an argument is rejected | VERIFIED | `features/marketplace/help.feature` has all three scenarios, each comparing kind, severity, needs reload, and the full `usage` (or `message` plus `usage`) through `the result has these fields:`. All pass against a real Pi (see spot-checks). `help.ts` emits `MARKETPLACE_USAGE` for the `marketplace` topic. |
| 2  | SC-2a: bare `marketplace` and an unknown subcommand show the usage with a reason | VERIFIED | Two help.feature scenarios pin `marketplace requires a subcommand.` and `Unknown marketplace subcommand: "bogus".`, each with the whole help block as `usage`. |
| 3  | SC-2b: `add`, `remove`, `info` without their argument fail as `Missing required argument.` | VERIFIED | `usage-errors.feature` Outline with 3 rows, each with that verb's own usage line. |
| 4  | SC-3a / USE-04: surplus arguments rejected on every verb | VERIFIED | Outline with 7 rows (add, remove, list, info, update, autoupdate, noautoupdate), `Too many arguments.`, per-verb usage line. |
| 5  | SC-3b / USE-05: unknown flags rejected, including `--local` on `list`, `info`, `update` | VERIFIED | 12-row Outline: `--bogus` on all 7 verbs, `--local` on list/info/update, and two first-flag-wins rows. |
| 6  | SC-3c / USE-06: bad or missing `--scope` value rejected in any position | VERIFIED | 14-row bad-value Outline (before and after the positional for each of the three parser paths, `--scope --local`, `--scope tools`) and a 7-row missing-value Outline covering every verb. |
| 7  | SC-3d / USE-07: explicit empty optional argument (`update ""`, `autoupdate ""`) rejected | VERIFIED | 8-row empty Outline: `add ''`, `add '   '`, `remove ''`, `info ''`, `update ''`, `update '   '`, `autoupdate ''`, `noautoupdate ''`, each naming its field (`Source` or `Marketplace name`) and giving the verb's usage line. |
| 8  | D-01: marketplace help shows `[--local]` on add, remove, autoupdate, noautoupdate | VERIFIED | `MARKETPLACE_USAGE` printed from the live module matches the `usage` cell in help.feature byte for byte; the four lines carry `[--local]`, alias column aligned. `08-02-RED.json` records the pre-fix failure (exitCode 1) for the four help scenarios. |
| 9  | D-02: one definition builds both the help and every verb's usage line | VERIFIED | `MARKETPLACE_VERB_SIGNATURES` in `edge/router.ts` feeds `marketplaceHelp()` and `marketplaceUsage(verb)`; the six marketplace handlers call `marketplaceUsage(...)` and no longer hold a usage literal (diff of add/autoupdate/info/list/remove/update). The WR-01 fix (f16b6be4) also derives the spelling list in `TOP_LEVEL_USAGE` and `MARKETPLACE_USAGE` from the same table; the `TOP_LEVEL_USAGE` marketplace line is byte-identical to `779eeced`. |
| 10 | D-05: an empty argument names its field (`Source`, `Marketplace name`, `Plugin name`) | VERIFIED | `PositionalSpec.label` is a required field; `parseCommandArgs` reports `<label> must not be empty.` for a supplied empty or blank positional and still reports the usage string for an omitted required one (USE-03 unchanged). Labels are wired in add, remove, info (shared helper), update, autoupdate, noautoupdate, and `parseRequiredPluginMarketplaceRef` ("Plugin name"). Scenarios cover uninstall, enable, disable. `08-03-RED.json` records the pre-fix failure of the 12 rows. |
| 11 | D-06: empty plugin ref, `@`, and plugin `list ''` named; partly malformed keeps `Invalid ... ref` | VERIFIED | `parsePluginRef` and `parsePluginTarget` in `edge/handlers/plugin/shared.ts` are called by install, info, uninstall/enable/disable, update, fetch, reinstall; `list.ts` rejects a blank name. `features/plugin/usage-errors.feature` pins 10 empty-ref rows, the `list ''` scenario, 4 `@` rows, and 8 partly-malformed rows. RED files 08-04 and 08-05 record failures before the fix. |
| 12 | WR-02 behavior change (blank half of a reference) is consistent with D-06 | VERIFIED | D-06 says a partly malformed ref keeps `Invalid <plugin>@<marketplace> ref`. After c4367e9a `splitPluginMarketplaceRef` returns undefined when either half is blank, so `install ' @official'` and `update 'foo@  '` give the invalid-reference message (pinned by Outline rows and by unit rows in `tests/edge/handlers/plugin/shared.test.ts`). Before the fix `' @official'` passed edge validation (`atIdx` 1 > 0), a real hole. Rule "whole-value empty gets a named field, anything else gets Invalid ref" holds, including `@` on `install`/`info`/`uninstall`, which have no `@<marketplace>` form. |

**Score:** 12/12 truths verified (0 present, behavior-unverified)

### Prohibitions (must_haves.prohibitions)

All eight are `verification: test`, status resolved, and each has wired enforcement (cucumber rows plus unit owners), so none is flagged.

| Prohibition | Enforcement | Status |
| ----------- | ----------- | ------ |
| 08-01 no ignoring an unknown flag or bad/missing `--scope`; no guessing a missing or surplus argument | unknown-flag, bad/missing scope, missing and surplus Outlines | enforced |
| 08-02 help never differs from the verb's own usage | one signature table plus the help scenarios and `flag-catalog-drift.test.ts` | enforced |
| 08-03 an empty name is never the nameless form | `update ''`, `autoupdate ''`, `noautoupdate ''` rows | enforced |
| 08-04 empty plugin list is not a success; empty-value rule not widened to partly malformed refs | `list ''` scenario; 8-row partly-malformed Outline | enforced |
| 08-05 empty `@` never widens to all | `update @`, `fetch @`, `reinstall @`, `reinstall '@   '` rows | enforced |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `features/marketplace/help.feature` | help, help-topic, extra-arg, bare, unknown scenarios | VERIFIED | 5 scenarios, 47 lines |
| `features/marketplace/usage-errors.feature` | six Outlines over every verb | VERIFIED | 127 lines, 6 Outlines |
| `features/plugin/usage-errors.feature` | empty-ref, list, `@`, partly-malformed | VERIFIED | 71 lines |
| `edge/router.ts` | signature table, `marketplaceUsage`, `MarketplaceVerb` | VERIFIED | exported and used by six handlers and `help.ts` |
| `edge/args-schema.ts` | `PositionalSpec.label`, named empty message | VERIFIED | required `label`; every call site compiles (check green) |
| `edge/handlers/marketplace/shared.ts` | `positionalLabel` option | VERIFIED | passed to the positional spec |
| `edge/handlers/plugin/shared.ts` | `parsePluginRef`, `parsePluginTarget`; `splitPluginMarketplaceRef` private | VERIFIED | `toFetchTarget`, `parseTarget`, inline update block gone |
| `08-02..05-RED.json` | recorded failing runs | VERIFIED | all four exist with `exitCode: 1` |
| `CHANGELOG.md` | D-01 bullet, empty-argument bullet with plugin sub-bullets | VERIFIED | in the diff from the phase base |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| marketplace handlers (6) | `router.ts` | `marketplaceUsage(verb)` | WIRED |
| `help.ts` | `MARKETPLACE_USAGE` | `help marketplace` branch | WIRED |
| install, info, uninstall/enable/disable | `parsePluginRef` | direct call | WIRED |
| update, fetch, reinstall | `parsePluginTarget` | direct call | WIRED |
| `openMarketplaceCommand` | `parseCommandArgs` | `label: opts.positionalLabel` | WIRED |
| plugin `list.ts` | empty-name rejection | `nonFlagPositionals[0]?.trim() === ""` | WIRED |

### Data-Flow Trace (Level 4)

Not applicable: there is no rendered dynamic data. The usage strings are built by pure functions from a constant table, and the scenarios read the payload the real extension emits.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All three phase features against a real Pi | `npm run test:cucumber -- features/marketplace/help.feature features/marketplace/usage-errors.feature features/plugin/usage-errors.feature --parallel 1` | 79 scenarios, 316 steps passed, 0 failed | PASS |
| Help block and top-level line match the spec | `node -e import(router.ts)` | `MARKETPLACE_USAGE` identical to the help.feature cell; `TOP_LEVEL_USAGE` marketplace line identical to the `779eeced` text | PASS |
| Unit owners of the changed modules | `node --test tests/edge/router.test.ts tests/edge/args-schema.test.ts tests/edge/handlers/plugin/shared.test.ts tests/edge/handlers/marketplace/shared.test.ts tests/architecture/flag-catalog-drift.test.ts` | exit 0 | PASS |
| No catalog or `cucumber.json` drift | `git diff --quiet 779eeced -- docs/output-catalog.md docs/json-output.md tests/architecture/catalog-uat/ cucumber.json` | exit 0 | PASS |

The full `npm run check` was not re-run, per instruction. It exited 0 at a393bead in the caller's session (313 scenarios).

### Probe Execution

Step 7c: SKIPPED. No probe scripts are declared by the phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| USE-01 | 08-02 | `marketplace help` and `help marketplace` show the usage | SATISFIED | help.feature scenarios 1 and 2 |
| USE-02 | 08-02 | bare or unknown subcommand shows usage with a reason | SATISFIED | help.feature scenarios 4 and 5 |
| USE-03 | 08-01 | `add`, `remove`, `info` without argument: `Missing required argument.` | SATISFIED | 3-row Outline; label change keeps the omitted case on the usage string |
| USE-04 | 08-01 | surplus arguments rejected | SATISFIED | 7-row Outline |
| USE-05 | 08-01 | unknown flags rejected, incl. `--local` on list/info/update | SATISFIED | 12-row Outline |
| USE-06 | 08-01 | bad or missing `--scope` value, any position | SATISFIED | 14-row and 7-row Outlines |
| USE-07 | 08-03, 08-04, 08-05 | explicitly empty optional argument rejected | SATISFIED | 8-row marketplace Outline plus plugin feature |
| USE-08 | 08-02 | `marketplace help` with an argument rejected | SATISFIED | help.feature scenario 3 |

All eight IDs appear in plan frontmatter (08-01: USE-03..06; 08-02: USE-01, 02, 08; 08-03/04/05: USE-07) and in REQUIREMENTS.md. No orphaned requirement is mapped to Phase 8.

### Anti-Patterns Found

None. No TBD, FIXME, or XXX in the touched production or feature files. No stubs; the label is a required type-level field. Every handler comment points at `marketplaceUsage` instead of copying usage text (IN-02 fix).

### Locked Decisions

D-01 to D-06 are honored (rows 8 to 11 above). The Claude's-discretion items resolved as: aliases `rm` and `ls` appear only inside the usage line, with no extra rows (RM-07 and LS-04 already pin them); `--scope --local` and `--scope tools` are pinned as invalid values. The top-level `help` text is not pinned and `TOP_LEVEL_USAGE` is unchanged in bytes. `help marketplace extra` is not pinned, which the discussion allowed.

### Review Loop

08-REVIEW-DISPOSITION.md shows 5 findings, all `fixed`, 0 open: IN-01 to IN-03, WR-01, WR-02. The fix commits (f16b6be4, c4367e9a, b9c37c02, af1191eb, 2c57764e, 99ff69ac, c1dee8ba) are present in the history. WR-01 and WR-02 are visible in the code. Their behavior is pinned by tests, not only by comments.

### Human Verification Required

None.

### Gaps Summary

No gaps. Every roadmap success criterion, every requirement ID (USE-01 to USE-08), and each locked decision is backed by code and by passing scenarios against a real Pi. The red-first runs for D-01 and D-05/D-06 are recorded in the 08-0N-RED.json files.

---

_Verified: 2026-10-20T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
