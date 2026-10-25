---
phase: 14-bootstrap-browse-help-and-usage-errors
review: 14-REVIEW.md
status: all_fixed
fixed: [WR-01, WR-02, WR-03, IN-01, IN-02, IN-03, IN-07]
skipped: [IN-04, IN-05, IN-06]
---

# Phase 14 Review Fix Report

## Fixed

- **WR-01:** `edge/router.ts` derives the help command identity from the same tokens the help
  handler reads (`isMarketplaceHelpTopic`), so `help "marketplace"` is `marketplace help`.
  Router test row added.
- **WR-02:** `pending` calls `rejectUnknownFlag` before the surplus check, so a flag in any
  position is the unknown flag. The pending test that pinned the first-token-only rule now
  pins the any-position rule (`surplus --frobnicate` row moved to the unknown-flag family).
- **WR-03:** `usage-errors.feature` gains `<verb> extra --bogus` rows for bootstrap, import,
  browse, pending, and help; 111 scenarios pass.
- **IN-01:** completions comment now says `help` takes one topic and rejects every flag.
- **IN-02:** bootstrap handler catch comment names autoupdate-step failures too.
- **IN-03:** `bootstrapClaudePlugin` tests `classifyAddError(err) !== "duplicate name"`, so a
  duplicate-name error wrapped with a cleanup leak stays the idempotent re-run.
- **IN-07 (part):** the browse unknown-flag test states its expected flag per row.

## Skipped (recorded for the orchestrator)

- **IN-04:** `marketplace help --bogus` still says `marketplace help takes no arguments.`
  while `help marketplace --bogus` says `Unknown flag`. `marketplace help` belongs to the
  marketplace surface and `features/marketplace/help.feature`, which this phase does not own.
- **IN-05:** `rejectUnknownFlag` stays in `edge/handlers/shared.ts`; moving it into the plugin
  `shared.ts` would split it from `extractLocalFlag`, the other flag scanner. No behavior change.
- **IN-06:** only `--`-prefixed tokens count as flags (house rule in every plugin handler,
  e.g. list, info, install). A single-dash token is a positional. `help ""` is the unknown
  topic `""`. Left as is; recorded as an assumption.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
