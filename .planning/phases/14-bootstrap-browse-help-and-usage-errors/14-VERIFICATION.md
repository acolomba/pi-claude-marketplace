---
phase: 14-bootstrap-browse-help-and-usage-errors
verified: 2026-10-23T00:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/14-bootstrap-browse-help-and-usage-errors/14-01-PLAN.md
  - .planning/phases/14-bootstrap-browse-help-and-usage-errors/14-01-SUMMARY.md
  - .planning/phases/14-bootstrap-browse-help-and-usage-errors/14-02-PLAN.md
  - .planning/phases/14-bootstrap-browse-help-and-usage-errors/14-02-SUMMARY.md
  - .planning/phases/14-bootstrap-browse-help-and-usage-errors/14-03-PLAN.md
  - .planning/phases/14-bootstrap-browse-help-and-usage-errors/14-03-SUMMARY.md
  - extensions/pi-claude-marketplace/edge/completions/provider.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts
  - extensions/pi-claude-marketplace/edge/handlers/shared.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
  - features/plugin/bootstrap.feature
  - features/plugin/browse.feature
  - features/plugin/help.feature
  - features/plugin/usage-errors.feature
  - test/edge/handlers/plugin/bootstrap.test.ts
  - test/edge/handlers/plugin/browse.test.ts
  - test/edge/handlers/plugin/help.test.ts
  - test/edge/handlers/plugin/import.test.ts
  - test/edge/handlers/plugin/info.test.ts
  - test/edge/handlers/plugin/install.test.ts
  - test/edge/handlers/plugin/list.test.ts
  - test/edge/handlers/plugin/pending.test.ts
  - test/edge/handlers/shared.test.ts
  - test/edge/register.test.ts
  - test/edge/router.test.ts
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/plugin/bootstrap.test.ts
covered_digest: "v3:sha256:fda7a0b6d55a1f2913847ed520f228ba7afa444b54068cce902a6547de47f8f1"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 14: Bootstrap, Browse, Help, and Usage Errors Verification Report

**Phase Goal:** The remaining plugin subcommands have scenarios: `bootstrap`, the `browse` refusal outside the TUI, plugin `help`, and the usage rejection of every plugin subcommand.
**Verified:** 2026-10-23
**Status:** passed (conditional on the phase session's `npm run check`, see below)
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `bootstrap` adds the official marketplace to the user scope through the GitHub base override, and a second run is a no-op. `bootstrap` with an argument or with `--scope` is rejected with its usage (BOO-01, BOO-02). | VERIFIED | `features/plugin/bootstrap.feature` (10 scenarios, all pass). First run: two `cascade` results compared whole (`added`, `autoupdate enabled`), the two clone requests to `/anthropics/claude-plugins-official.git` on the loopback host (`features/support/pi-process.ts:91` sets `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` to it), user config declares the marketplace with `autoupdate: true`, project config absent. Second run: exactly one result (`lastResult()` fails on more than one, `features/support/world.ts:168-179`), one `skipped` row `already autoupdate`, `the git host receives no request`, config unchanged. Rejection outline: `official`, `--bogus`, `--local`, `--scope user`, `--scope project`, `--scope bad`, bare `--scope`, each with `Usage: /claude:plugin bootstrap`. Extra: the 404 scenario proves D-01 (failed row with reason `source missing` and cause chain; exactly one result, so the autoupdate step did not run; nothing recorded, no clones). Code: `orchestrators/plugin/bootstrap.ts` calls `notifyAddFailure` for every add error whose `classifyAddError` is not `duplicate name`; `notifyAddFailure` (`orchestrators/marketplace/add.ts:889`) is the standalone arm of `handleAddFailure`, which rethrows non-precondition errors (`add.ts:845-851`) to the handler's catch. |
| 2 | `browse` outside the TUI is refused with a message that names `list` (BRW-01). | VERIFIED | `features/plugin/browse.feature` (3 scenarios pass): `browse` and bare `/claude:plugin` in rpc mode return a usage-error whose message is `Browse is unavailable in rpc mode. Use /claude:plugin list instead.` with usage `Usage: /claude:plugin browse`, compared whole; `browse extra` -> `browse takes no arguments.` |
| 3 | `help` shows the plugin usage, and `help <unknown topic>` is rejected (HLP-01). | VERIFIED | `features/plugin/help.feature` (4 scenarios pass): `help` and `help help` return `usage-info` with the full `TOP_LEVEL_USAGE` text compared byte for byte; `help bogus` -> `Unknown help topic: "bogus".` with `Usage: /claude:plugin help [marketplace]`; `/claude:plugin bogus` -> `Unknown subcommand: "bogus".` with the plugin usage. Code: `edge/handlers/plugin/help.ts` tokenizes, rejects flags, rejects more than one topic. |
| 4 | Every plugin subcommand rejects a flag it does not accept, extra positional arguments, and a bad `--scope` value, with the same result shape the marketplace usage-error feature checks (USE-01). | VERIFIED | Matrix below: every routed plugin subcommand and alias in `TOP_LEVEL_SUBCOMMANDS` (`edge/router.ts`) except the `marketplace` namespace has an unknown-flag row and a too-many-arguments row; every one that accepts `--scope` has a bad-value row and a missing-value row; `browse` and `help`, which do not accept `--scope`, have a `--scope` unknown-flag row. Each row compares kind, severity, needs reload, message and usage, the same five fields as `features/marketplace/usage-errors.feature`. All 111 scenarios of `usage-errors.feature` pass. |
| 5 | The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green. | VERIFIED (cucumber, check:features); `npm run check` run by the phase session | `npx cucumber-js features/plugin/bootstrap.feature features/plugin/usage-errors.feature features/plugin/help.feature features/plugin/browse.feature`: 128 scenarios (128 passed), 527 steps passed, exit 0. `npm run check:features`: exit 0. `npm run check`: run by the phase session, result below. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

npm run check: PASS (exit 0, run by the phase session at 8b6c941c+4b192645: static checks, unpaired and integration tests, 567 cucumber scenarios, direct coverage). The table realignment commit after it is whitespace-only in feature files; its hook ran check:commit.

### Plan must-haves (merged)

| Plan | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 14-01 | First bootstrap adds through the base override and turns on autoupdate | VERIFIED | Truth 1 |
| 14-01 | Second bootstrap is a no-op (skipped, already autoupdate, no git request) | VERIFIED | Truth 1 |
| 14-01 | 404 bootstrap reports the `marketplace add` failed row with reason and cause, records nothing, skips autoupdate (D-01) | VERIFIED | Truth 1; single-result guard proves no autoupdate result |
| 14-01 | Positional, unknown flag, `--scope user/project/bad` rejected with bootstrap usage | VERIFIED | Truth 1 |
| 14-02 | Every subcommand and alias rejects an unknown flag as `Unknown flag: "<flag>".` | VERIFIED | Matrix below |
| 14-02 | Operand subcommands reject surplus with `Too many arguments.`; zero-operand ones keep their sentence | VERIFIED | Matrix below |
| 14-02 | `--scope` bad value in either position and missing value; browse/help reject `--scope` as unknown flag | VERIFIED | Matrix below |
| 14-02 | Each rejection compared whole like the marketplace feature | VERIFIED | `the result has these fields:` appends any unstated field before `deepStrictEqual` (`features/lib/field-rows.ts:78`, `features/step_definitions/command.steps.ts:75`) |
| 14-03 | browse / bare command refused naming `/claude:plugin list` | VERIFIED | Truth 2 |
| 14-03 | help shows the whole usage; unknown topic rejected | VERIFIED | Truth 3 |
| 14-03 | Unknown plugin subcommand shows the usage with a reason | VERIFIED | Truth 3 |

### USE-01 coverage matrix (`features/plugin/usage-errors.feature`)

| Subcommand | Unknown flag | Too many arguments | Bad `--scope` value | `--scope` with no value |
| --- | --- | --- | --- | --- |
| bootstrap | `--bogus`, `extra --bogus` | `bootstrap takes no arguments.` | `--scope bad` | yes |
| install | `--bogus`, `--dry-run` | `Too many arguments.` (two rows) | both positions | yes |
| uninstall | `--bogus` | yes | both positions | yes |
| prune | `--bogus`, `--local` | yes | yes (no positional) | yes |
| update | `--bogus` | yes | both positions | yes |
| fetch | `--bogus`, `--local` | yes | both positions | yes |
| reinstall | `--bogus` | yes | both positions | yes |
| list | `--bogus`, `--local`, `--bogus --other` | yes | both positions | yes |
| ls | `--bogus` | yes | both positions | yes |
| info | `--bogus`, `--local` | yes | both positions | yes |
| pending | `--bogus`, `--local`, `extra --bogus` | yes | yes (no positional) | yes |
| enable | `--bogus`, `--keep-data` | yes | both positions, plus `--scope --local` | yes |
| disable | `--bogus` | yes | both positions | yes |
| import | `--bogus`, `--local`, `extra --bogus` | `import does not accept positional arguments.` | yes (no positional) | yes |
| browse | `--bogus`, `--scope user`, `extra --bogus` | `browse takes no arguments.` | n/a (`--scope` is an unknown flag) | n/a |
| help | `marketplace --bogus`, `marketplace --scope user`, `marketplace extra --bogus` | `help marketplace extra` | n/a (`--scope` is an unknown flag) | n/a |
| marketplace | namespace, not a leaf verb: its verbs are covered by `features/marketplace/usage-errors.feature` (not this phase) | | | |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/plugin/bootstrap.feature` | Bootstrap scenarios | VERIFIED | 4 scenarios / 10 executed, all pass |
| `features/plugin/usage-errors.feature` | Usage rejections of every plugin subcommand | VERIFIED | 8 outlines, 111 executed, all pass |
| `features/plugin/browse.feature` | Browse refusal | VERIFIED | 3 scenarios pass |
| `features/plugin/help.feature` | Plugin help | VERIFIED | 4 scenarios pass |
| `orchestrators/marketplace/add.ts` `notifyAddFailure` | Public failed-add rendering | VERIFIED | Exported, called by `bootstrapClaudePlugin` |
| `edge/handlers/shared.ts` `rejectUnknownFlag` | Shared unknown-flag rejection | VERIFIED | Used by bootstrap, import, browse, help, pending |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `orchestrators/plugin/bootstrap.ts` `bootstrapClaudePlugin` | `orchestrators/marketplace/add.ts` `notifyAddFailure` | every add error except duplicate name | WIRED | `classifyAddError(err) !== "duplicate name"` -> `notifyAddFailure(addOptions, err); return;` |
| `edge/router.ts` `help` route | `edge/handlers/plugin/help.ts` | `isMarketplaceHelpTopic` (tokenized) | WIRED | Router and handler read the same tokens (WR-01 fix) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase scenarios | `npx cucumber-js features/plugin/{bootstrap,usage-errors,help,browse}.feature` | 128 scenarios passed, exit 0 | PASS |
| Feature-file gate | `npm run check:features` | exit 0 | PASS |
| Changed source-test pairs | `node --test` on the 13 test files the phase changed | 764 pass, 0 fail | PASS |
| Feature formatting | `npx prettier --check features` | clean (prettier does not align Gherkin tables) | PASS |
| Full gate | `npm run check` | run by the phase session | pending |

### Probe Execution

No probes declared or applicable (Step 7c: SKIPPED).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| BOO-01 | 14-01 | bootstrap adds the official marketplace to user scope through the GitHub base override; second run is a no-op | SATISFIED | Truth 1, first and second-run scenarios |
| BOO-02 | 14-01 | bootstrap with an argument or `--scope` is rejected with its usage | SATISFIED | Truth 1, rejection outline |
| BRW-01 | 14-03 | browse outside the TUI is refused naming `list` | SATISFIED | Truth 2 |
| HLP-01 | 14-03 | help shows the plugin usage; `help <unknown topic>` is rejected | SATISFIED | Truth 3 |
| USE-01 | 14-02 | every plugin subcommand rejects an unknown flag, extra positionals, a bad `--scope`, matching the marketplace usage-error feature | SATISFIED | Truth 4 and matrix |

No orphaned requirements: REQUIREMENTS.md maps exactly these five IDs to Phase 14, and each appears in a plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (all changed files) | - | TBD/FIXME/XXX/TODO/HACK | none found | - |
| `features/plugin/usage-errors.feature` | 102-106 | Table columns not aligned: the five `<verb> extra --bogus` rows added by WR-03 pad the `usage` column 10 characters short of the other rows | WARNING (cucumber rule "Align the columns") | FIXED: realigned, whitespace only |
| `features/plugin/usage-errors.feature` | 98 | Header cell `Unknown flag: "<flag>".  ` carries one extra pad space | INFO | Cosmetic |
| `features/plugin/bootstrap.feature` | 19 | Request-table header's `path` column is 3 characters narrower than its rows | WARNING (alignment) | FIXED: realigned, whitespace only |
| `features/plugin/bootstrap.feature` | 53 | 404 plugin-table header is 1 character wider than its row | WARNING (alignment) | FIXED: realigned, whitespace only |
| `features/plugin/bootstrap.feature` | 72-73 | The two `bootstrap does not accept --scope...` example rows are 1 character short in the `message` column | WARNING (alignment) | FIXED: realigned, whitespace only |

### Human Verification Required

None. Every truth has a passing behavioral scenario. The TUI browse picker is out of scope (no terminal UI in the headless driver).

### Gaps Summary

No goal-blocking gaps. The phase goal holds in the code and the scenarios: every criterion has a scenario that compares the result whole, and the single-result guard in `lastResult()` also proves the failed bootstrap skips the autoupdate step. The only findings are cucumber table-alignment warnings in two feature files. The phase session's `npm run check` passed, and the alignment warnings were fixed afterwards.

## For the orchestrator

- Deferred (14-REVIEW-FIX IN-04): `marketplace help --bogus` still says `marketplace help takes no arguments.` while `help marketplace --bogus` says `Unknown flag: "--bogus".`; owned by the marketplace surface / `features/marketplace/help.feature`.
- Deferred (14-REVIEW-FIX IN-05): `rejectUnknownFlag` stays in `edge/handlers/shared.ts` rather than the plugin `shared.ts`; no behavior change.
- Deferred (14-REVIEW-FIX IN-06): only `--`-prefixed tokens count as flags; a single-dash token is a positional and `help ""` is the unknown topic `""`; recorded as an assumption.
- Deferred (14-CONTEXT): the bootstrap handler's catch-all failed row for a non-precondition error (for example a held state lock) still carries no cause; Phase 15 (state lock) owns lock scenarios.
- Product change: `install`, `info` reject a surplus positional with `Too many arguments.` (was `<verb> requires exactly one <plugin>@<marketplace> argument.`; the missing-operand sentence is unchanged).
- Product change: `list`/`ls`, `pending` reject an unknown flag with `Unknown flag: "<flag>".` (was `Unknown option: "<flag>".`); `pending` now rejects a flag in any position, not only the first token.
- Product change: `import` rejects a flag token with `Unknown flag: "<flag>".` (was `import does not accept positional arguments.`); the positional sentence is unchanged. `bootstrap` and `browse` likewise reject flag tokens as `Unknown flag`; `help` rejects flags as `Unknown flag` and a second topic as `Too many arguments.`
- Product change: a failed bootstrap add now renders the `marketplace add` failed row, named by the typed source `anthropics/claude-plugins-official` (was the manifest name `claude-plugins-official`), with reason and cause chain, and the autoupdate step does not run.
- Product change: `help "marketplace"` (quoted) routes as `marketplace help` (router `isMarketplaceHelpTopic`).
- Fixed after verification (whitespace only): Gherkin table columns were misaligned in `features/plugin/usage-errors.feature` lines 102-106 (WR-03 rows) and `features/plugin/bootstrap.feature` lines 19, 53, 72-73; the cucumber rule says "Align the columns" and `npm run check:features` does not check it. A whitespace-only fix.
- Info: the `marketplace` entry of `TOP_LEVEL_SUBCOMMANDS` is a namespace; its leaf verbs' usage rejections live in `features/marketplace/usage-errors.feature`, which has no rows for the `rm`/`ls` aliases or `marketplace help` (outside this phase's ownership).
- Full gate: `npm run check` is run by the phase session (fill the placeholder line under the truths table); if red, flip status to `gaps_found`.

---

_Verified: 2026-10-23_
_Verifier: Claude (gsd-verifier)_

- Assumption: `bootstrap` has no upstream command; its failure parity is anchored to `claude plugin marketplace add` (Claude Code 2.1.308 prints the clone failure's cause). Parity wording for usage errors anchored to commander's "unknown option" / "too many arguments" split.
- Info (outside this phase): `features/marketplace/usage-errors.feature` has no rows for the `rm`/`ls` aliases or for `marketplace help`.
- Merge note: the handler wording changes touch files of verbs other phases test (install, info, list, pending, import); a conflict, if any, is local to the rejection branch.
