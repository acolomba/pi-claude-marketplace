---
phase: 14-bootstrap-browse-help-and-usage-errors
verified: 2026-10-23T12:00:00Z
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
covered_digest: "v3:sha256:4c277f6f6501428772f03374f7b93e72bf41cc41b17c1e65ebc8555c579fd44d"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 14: Bootstrap, Browse, Help, and Usage Errors Verification Report

**Phase Goal:** The remaining plugin subcommands have scenarios: `bootstrap`, the `browse` refusal outside the TUI, plugin `help`, and the usage rejection of every plugin subcommand.
**Verified:** 2026-10-23 (combined milestone tree, all 15 phases merged, HEAD `7a9b6107`)
**Status:** passed
**Re-verification:** Yes -- previous report was stale because Phase 15 changed two covered files (`orchestrators/marketplace/add.ts`, `test/orchestrators/marketplace/add.test.ts`). The remaining covered files are byte-identical to the previous verification (`git diff bd480191 HEAD` over every covered source, test and feature path shows only those two files).

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `bootstrap` adds the official marketplace to the user scope through the GitHub base override, and a second run is a no-op. `bootstrap` with an argument or with `--scope` is rejected with its usage (BOO-01, BOO-02). | VERIFIED | `features/plugin/bootstrap.feature` (10 executed scenarios, all pass on the merged tree): first run compares both cascade results whole (`added`, `autoupdate enabled`) and the clone requests to `/anthropics/claude-plugins-official.git` on the loopback host; second run has exactly one `skipped` row `already autoupdate` and the git host receives no request; rejection outline covers `official`, `--bogus`, `--local`, `--scope user/project/bad` and bare `--scope`; the 404 scenario proves the failed row with cause and no autoupdate step. Code still wired: `orchestrators/plugin/bootstrap.ts:126-130` calls `notifyAddFailure(addOptions, err); return;` for every add error that `classifyAddError` does not class as `duplicate name`. |
| 2 | `browse` outside the TUI is refused with a message that names `list` (BRW-01). | VERIFIED | `features/plugin/browse.feature` (3 scenarios pass). `edge/handlers/plugin/browse.ts:147` still emits `Browse is unavailable in ${mode} mode. Use /claude:plugin list instead.` |
| 3 | `help` shows the plugin usage, and `help <unknown topic>` is rejected (HLP-01). | VERIFIED | `features/plugin/help.feature` (4 scenarios pass). `edge/handlers/plugin/help.ts:40` still emits `Unknown help topic: "<topic>".`; surplus topics give `Too many arguments.` (line 24). |
| 4 | Every plugin subcommand rejects a flag it does not accept, extra positional arguments, and a bad `--scope` value, with the same result shape the marketplace usage-error feature checks (USE-01). | VERIFIED | `features/plugin/usage-errors.feature`: all 111 executed scenarios pass; matrix below unchanged (feature file and every handler/router file byte-identical to the previous verification). |
| 5 | The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green. | VERIFIED | `npx cucumber-js --parallel 2 features/plugin/{bootstrap,usage-errors,help,browse}.feature`: 128 scenarios (128 passed), 527 steps passed, exit 0. `npm run check:features`: exit 0. `npm run check`: run by the orchestrator on this exact tree: green (static, unpaired, integration, 702/702 cucumber scenarios, direct coverage). |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Effect of Phase 15 on this phase

Phase 15 (FLR-02) added `surfaceLockHeldAdd` and a `StateLockHeldError` arm at the head of `handleAddFailure` in `orchestrators/marketplace/add.ts`. This sits on the path bootstrap uses for a failed add, so it was traced explicitly:

- Bootstrap passes `rethrowPreconditionErrors: true`; `runAddOutcome` rethrows the raw error before `handleAddFailure`, so the bootstrap catch receives it. For `duplicate name` the idempotent path is unchanged (`classifyAddError` still returns it; the lock arm does not intercept it). For a 404 or any other classified error, `notifyAddFailure` -> `handleAddFailure(opts, err, false)` takes the same classified-reason arm as before, so the bootstrap 404 scenario still passes unchanged.
- New behavior for bootstrap under a held state lock: the rethrown `StateLockHeldError` reaches `notifyAddFailure`, which now renders the `lock held` failed row with the lock error as cause (before Phase 15 it rethrew to the handler's catch-all failed row without cause). This resolves the deferred item recorded previously ("catch-all failed row ... carries no cause"). No phase-14 scenario exercises bootstrap under a held lock and none is required by the roadmap; Phase 15's `features/marketplace/state-lock.feature` covers `marketplace add` itself.

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
| `features/plugin/bootstrap.feature` | Bootstrap scenarios | VERIFIED | Present, 10 executed, all pass |
| `features/plugin/usage-errors.feature` | Usage rejections of every plugin subcommand | VERIFIED | 111 executed, all pass |
| `features/plugin/browse.feature` | Browse refusal | VERIFIED | 3 pass |
| `features/plugin/help.feature` | Plugin help | VERIFIED | 4 pass |
| `orchestrators/marketplace/add.ts` `notifyAddFailure` | Public failed-add rendering | VERIFIED | Exported (line ~930), called by `bootstrapClaudePlugin` |
| `edge/handlers/shared.ts` `rejectUnknownFlag` | Shared unknown-flag rejection | VERIFIED | Unchanged, used by bootstrap, import, browse, help, pending |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `orchestrators/plugin/bootstrap.ts` `bootstrapClaudePlugin` | `orchestrators/marketplace/add.ts` `notifyAddFailure` | every add error except duplicate name | WIRED | `bootstrap.ts:126-130`; Phase 15's lock arm only adds a case ahead of the classifier |
| `edge/router.ts` `help` route | `edge/handlers/plugin/help.ts` | `isMarketplaceHelpTopic` (tokenized) | WIRED | Files unchanged |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase scenarios | `npx cucumber-js --parallel 2 features/plugin/{bootstrap,usage-errors,help,browse}.feature` | 128 scenarios passed, 527 steps passed | PASS |
| Feature-file gate | `npm run check:features` | exit 0 | PASS |
| Full gate | `npm run check` | green on this tree, run by the orchestrator (not re-run) | PASS |

### Probe Execution

No probes declared or applicable (Step 7c: SKIPPED).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| BOO-01 | 14-01 | bootstrap adds the official marketplace to user scope through the GitHub base override; second run is a no-op | SATISFIED | Truth 1 |
| BOO-02 | 14-01 | bootstrap with an argument or `--scope` is rejected with its usage | SATISFIED | Truth 1, rejection outline |
| BRW-01 | 14-03 | browse outside the TUI is refused naming `list` | SATISFIED | Truth 2 |
| HLP-01 | 14-03 | help shows the plugin usage; `help <unknown topic>` is rejected | SATISFIED | Truth 3 |
| USE-01 | 14-02 | every plugin subcommand rejects an unknown flag, extra positionals, a bad `--scope`, matching the marketplace usage-error feature | SATISFIED | Truth 4 and matrix |

No orphaned requirements: the five IDs mapped to Phase 14 each appear in a plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (changed files) | - | TBD/FIXME/XXX | none found | - |

### Human Verification Required

None. Every truth has a passing behavioral scenario. The TUI browse picker is out of scope (no terminal UI in the headless driver).

### Gaps Summary

No gaps. The phase goal and all five criteria still hold on the combined tree. Phase 15's change to the failed-add path does not alter the bootstrap duplicate-name or 404 behavior the scenarios pin.

## For the orchestrator

- Resolved (was: deferred, 14-CONTEXT): the bootstrap handler's failed row for a held state lock carried no cause. Phase 15's `surfaceLockHeldAdd` now gives a bootstrap run under a held lock the same `lock held` row with the lock error as cause as `marketplace add`. Not covered by a phase-14 scenario; Phase 15 owns lock scenarios for `marketplace add`.
- Deferred (14-REVIEW-FIX IN-04): `marketplace help --bogus` still says `marketplace help takes no arguments.` while `help marketplace --bogus` says `Unknown flag: "--bogus".`; owned by the marketplace surface / `features/marketplace/help.feature`.
- Deferred (14-REVIEW-FIX IN-05): `rejectUnknownFlag` stays in `edge/handlers/shared.ts` rather than the plugin `shared.ts`; no behavior change.
- Deferred (14-REVIEW-FIX IN-06): only `--`-prefixed tokens count as flags; a single-dash token is a positional and `help ""` is the unknown topic `""`; recorded as an assumption.
- Product change: `install`, `info` reject a surplus positional with `Too many arguments.` (was `<verb> requires exactly one <plugin>@<marketplace> argument.`; the missing-operand sentence is unchanged).
- Product change: `list`/`ls`, `pending` reject an unknown flag with `Unknown flag: "<flag>".` (was `Unknown option: "<flag>".`); `pending` now rejects a flag in any position, not only the first token.
- Product change: `import` rejects a flag token with `Unknown flag: "<flag>".` (was `import does not accept positional arguments.`); the positional sentence is unchanged. `bootstrap` and `browse` likewise reject flag tokens as `Unknown flag`; `help` rejects flags as `Unknown flag` and a second topic as `Too many arguments.`
- Product change: a failed bootstrap add now renders the `marketplace add` failed row, named by the typed source `anthropics/claude-plugins-official` (was the manifest name `claude-plugins-official`), with reason and cause chain, and the autoupdate step does not run.
- Product change: `help "marketplace"` (quoted) routes as `marketplace help` (router `isMarketplaceHelpTopic`).
- Info: the `marketplace` entry of `TOP_LEVEL_SUBCOMMANDS` is a namespace; its leaf verbs' usage rejections live in `features/marketplace/usage-errors.feature`, which has no rows for the `rm`/`ls` aliases or `marketplace help` (outside this phase's ownership).
- Closed: the previous "Fixed after verification (whitespace only)" table-alignment note and the "fill the placeholder line for `npm run check`" item. Both are resolved; the full gate is green on the combined tree.
- Assumption: `bootstrap` has no upstream command; its failure parity is anchored to `claude plugin marketplace add` (Claude Code 2.1.308 prints the clone failure's cause). Parity wording for usage errors anchored to commander's "unknown option" / "too many arguments" split.
- Merge note: the handler wording changes touch files of verbs other phases test (install, info, list, pending, import); no conflicts surfaced on the combined tree (702/702 scenarios green).

---

_Verified: 2026-10-23_
_Verifier: Claude (gsd-verifier)_
