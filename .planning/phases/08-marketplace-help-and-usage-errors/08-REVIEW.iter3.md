---
phase: 08-marketplace-help-and-usage-errors
reviewed: 2026-10-20T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - CHANGELOG.md
  - docs/open-closed-proof.md
  - extensions/pi-claude-marketplace/edge/args-schema.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - features/marketplace/help.feature
  - features/marketplace/usage-errors.feature
  - features/plugin/usage-errors.feature
  - tests/architecture/flag-catalog-drift.test.ts
  - tests/edge/args-schema.test.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/autoupdate.test.ts
  - tests/edge/handlers/marketplace/info.test.ts
  - tests/edge/handlers/marketplace/list.test.ts
  - tests/edge/handlers/marketplace/remove.test.ts
  - tests/edge/handlers/marketplace/shared.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/handlers/plugin/fetch.test.ts
  - tests/edge/handlers/plugin/info.test.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/edge/handlers/plugin/list.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/edge/handlers/plugin/shared.test.ts
  - tests/edge/handlers/plugin/update.test.ts
  - tests/edge/router.test.ts
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-10-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found (Info only)

## Summary

This is a re-review of the phase diff (`15fdfe83..HEAD`) after the two fix commits:

- `f16b6be4` fixes WR-01 (the marketplace verb list was hand-copied).
- `c4367e9a` fixes WR-02 (a blank half of a plugin reference passed the edge check).

I checked each fix against the earlier finding. I looked for regressions in every caller of the changed code. I then re-read the rest of the phase diff for anything the first pass missed.

**WR-01 is fixed, and the fix is complete.** `MARKETPLACE_VERB_SIGNATURES` is now `as const satisfies Record<string, MarketplaceVerbSignature>`, and `MarketplaceVerb` is `keyof typeof` that object. The spelling list `MARKETPLACE_SPELLINGS` comes from the rows. Both the marketplace help header (`router.ts:173`) and the `marketplace <...>` line of `TOP_LEVEL_USAGE` (`router.ts:153`) use it.

Two sets of tests hold this together:

- The new router test (`router.test.ts:434-449`) ties both headers, in order, to `MARKETPLACE_SUBCOMMANDS` minus `help`.
- The existing test at `router.test.ts:424-432` ties `MARKETPLACE_SUBCOMMANDS` to the dispatch rows.

So each of these now fails a test:

- a signature row with no subcommand token;
- a token or alias with no row;
- an alias that differs between the row and the token list.

I checked these points and found no problem:

- `MARKETPLACE_SPELLINGS` is declared before `TOP_LEVEL_USAGE`, so there is no TDZ hazard.
- The keys are not integer-like, so `Object.entries` keeps the row order.
- `router.ts` still imports only `shared/notification-dispatch.ts`, so the handler modules that call `marketplaceUsage(...)` at load time cannot form a cycle.
- The rendered help bytes did not change. The pinned `EXPECTED_MARKETPLACE_USAGE` and the help scenarios still match.

**WR-02 is fixed, and the fix is complete.** `splitPluginMarketplaceRef` (`plugin/shared.ts:29-42`) now rejects a blank half after trimming. It also keeps every case the old `atIdx <= 0 || atIdx === ref.length - 1` test rejected, because an empty half is also blank. Every caller goes through `parsePluginRef`:

- `install`, `info`, and `parseRequiredPluginMarketplaceRef`, which serves `uninstall`, `enable`, and `disable`;
- `parsePluginTarget`, which serves `update`, `fetch`, and `reinstall`.

So `' @official'` and `'alpha@  '` now get the invalid-ref usage error with the verb's own usage line on every plugin verb.

These behaviors did not change:

- the accepted forms (`alpha@official`, and `alpha@official@mirror` split at the first `@`);
- the whole-blank rule (`Plugin name must not be empty.`);
- the `@` / `@   ` rule (`Marketplace name must not be empty.`).

The fix reaches no code outside `edge/handlers/plugin/`. Its new feature rows pass through the real tokenizer and through the `--local` residual rebuild. I ran `tests/edge/router.test.ts`, `tests/edge/handlers/plugin/shared.test.ts`, and `tests/edge/args-schema.test.ts` under a temporary `HOME`: 206 of 206 passed.

A second pass over the rest of the diff found no new correctness defect. It covered:

- `parseCommandArgs`'s split between an omitted and an empty positional;
- the `positionalLabel` plumbing through `openMarketplaceCommand`;
- the plugin `list ""` guard;
- the swap of each handler's local target parser for `parsePluginTarget`;
- the CHANGELOG bullets against the shipped messages.

Three Info items remain. Two are the out-of-scope items from the last pass, still present. The third is a small understatement in the doc bullet that the WR-01 fix rewrote.

## Narrative Findings (AI reviewer)

## Info

### IN-01: The handler header comments still state the old usage, without `[--local]` (still present)

**File:** `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts:4`, `extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts:4`, `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts:4`, `:6`

**Issue:** These modules take `USAGE` from `marketplaceUsage(...)`, but their file-header comments still write the signature by hand, without `[--local]`:

- `` `/claude:plugin marketplace add <source> [--scope user|project]` ``
- `` `/claude:plugin marketplace <remove|rm> <name> [--scope user|project]` ``
- `` `autoupdate [<name>] [--scope user|project]` `` and the same line for `noautoupdate`

USE-01 asks that the help and the usage lines agree. These comments are a third copy of the signature that nothing checks, and they already disagree with the rows. (The last report cited `autoupdate.ts:135-137`. The correct lines are 4 and 6.)

**Fix:** Remove the flag lists from the headers, for example: "Thin-shim handler factory for `marketplace add`; its usage line comes from `marketplaceUsage("add")`." If the headers keep the flags, add `[--local]` to each.

### IN-02: An edited header comment in `info.test.ts` was not reflowed (still present)

**File:** `tests/edge/handlers/marketplace/info.test.ts:9`

**Issue:** Line 9 is 143 characters long, and line 7 is 54. The file's other comment lines are under 80 characters, and Prettier does not reflow comments.

**Fix:** Reflow lines 6-10 to the file's width.

### IN-03: The rewritten open-closed bullet still says a new top-level verb needs only one `TOP_LEVEL_USAGE` line

**File:** `docs/open-closed-proof.md:20`; `extensions/pi-claude-marketplace/edge/router.ts:138`

**Issue:** The WR-01 fix rewrote this bullet so that it names every edit a new verb needs. For marketplace verbs it is now exact. For top-level verbs it still says "a new top-level verb adds one `TOP_LEVEL_USAGE` line". In fact two edits are needed inside `TOP_LEVEL_USAGE`:

- the verb's own line;
- its spelling in the hand-written header `<bootstrap|install|...|help>` at `router.ts:138`.

No test ties that header to `TOP_LEVEL_SUBCOMMANDS`. Only the whole-string pin `EXPECTED_TOP_LEVEL_USAGE` covers it, which is the same weakness WR-01 described for the marketplace header. The top-level help text is outside this phase (it is left for the deferred top-level help fix), so the code can wait. The doc sentence, which this phase wrote, is the part that is wrong now.

**Fix:** Change the doc to: "a new top-level verb adds one `TOP_LEVEL_USAGE` line and its spelling in the `TOP_LEVEL_USAGE` header". Alternatively, carry the header derivation and a test like `router.test.ts:434-449` into the deferred top-level help work.

---

_Reviewed: 2026-10-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
