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
  info: 2
  total: 2
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-10-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found (Info only)

## Summary

This is the third re-review of the phase diff (`15fdfe83..HEAD`). Since the last review, three fix commits landed:

- `b9c37c02` fixes IN-01: the handler headers no longer copy the usage by hand.
- `af1191eb` fixes IN-02: the `info.test.ts` header is reflowed.
- `2c57764e` fixes IN-03: the open-closed doc now names both usage edits for a top-level verb.

I also re-checked the two earlier fixes, `f16b6be4` (WR-01) and `c4367e9a` (WR-02).

**All five fixes hold, and none of them caused a regression.**

- **IN-01:** The `add.ts`, `remove.ts`, and `autoupdate.ts` headers now point at `marketplaceUsage(...)` and no longer list the flags.
- **IN-02:** Every comment line in the `info.test.ts` header is now under 80 characters.
- **IN-03:** `docs/open-closed-proof.md:20` is correct for both kinds of verb. A top-level verb needs its `TOP_LEVEL_USAGE` line and its spelling in the header. A marketplace verb needs its signature row, plus the `SubcommandHandlers` field, the `MARKETPLACE_SUBCOMMANDS` tokens, and the switch `case`. Its type, both help lines, and both spelling lists come from the row.
- **WR-01:** The marketplace verb list is now built from the signature rows. `router.test.ts:434-449` ties both spelling headers to `MARKETPLACE_SUBCOMMANDS`. `router.ts` still imports only `shared/notification-dispatch.ts`, so the handler modules that call `marketplaceUsage(...)` when they load cannot form an import cycle.
- **WR-02:** I traced `splitPluginMarketplaceRef` (`plugin/shared.ts:29-42`) through every caller:
  - `install` and `info` call `parsePluginRef` directly.
  - `uninstall`, `enable`, and `disable` reach it through `parseRequiredPluginMarketplaceRef`.
  - `update`, `fetch`, and `reinstall` reach it through `parsePluginTarget`.

  A blank half (`' @official'`, `'alpha@  '`) now gets the invalid-reference error on every verb. A whole-blank reference still gets `Plugin name must not be empty.`. `@` and `'@   '` on the three target verbs still get `Marketplace name must not be empty.`.

I ran these test files with a temporary `HOME`, and every test passed:

- `tests/edge/router.test.ts`
- `tests/edge/args-schema.test.ts`
- `tests/edge/handlers/plugin/shared.test.ts`
- `tests/edge/handlers/marketplace/shared.test.ts`
- `tests/architecture/flag-catalog-drift.test.ts`

A fresh pass over the whole diff found no new correctness defect. It covered:

- the tokenizer's handling of `''` and `'   '`, and the `--local` residual rebuild that keeps the quotes;
- the per-verb labels;
- the plugin `list ""` guard;
- the swap of each handler's local target parser for `parsePluginTarget`;
- the help and usage-error scenarios against the router output;
- the CHANGELOG bullets against the shipped messages.

Two small Info items remain. Neither affects behavior.

## Narrative Findings (AI reviewer)

## Info

### IN-01: The `parseCommandArgs` doc comment gets the order of the omitted and empty checks wrong

**File:** `extensions/pi-claude-marketplace/edge/args-schema.ts:62-69`, `:106-123`

**Issue:** The doc comment says the function reports, in order, "an omitted required positional, as the `usage` string itself", and then "a supplied empty or blank positional". But the loop at lines 106-123 checks one slot at a time, so an empty early slot is reported before an omitted later slot. Run against a schema with two required positionals, `parseCommandArgs("''", ...)` reports `A must not be empty.`, not the usage string. I checked this directly.

No current caller declares more than one positional, so nothing a user sees is wrong today. But the comment states a precedence the code does not have. A future two-positional verb whose author trusts the comment would get the other message.

**Fix:** State the order per slot. For example:

```ts
 *   - surplus positionals, as `Too many arguments.`;
 *   - then, slot by slot in schema order, an omitted required positional as
 *     the `usage` string itself, or a supplied empty or blank positional,
 *     required or optional, as `<label> must not be empty.` (USE-07).
```

### IN-02: Three marketplace handler headers still copy their usage line by hand

**File:** `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts:3-4`, `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts:3-4`, `extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts:3-4`

**Issue:** `b9c37c02` replaced the hand-written usage in the `add`, `remove`, and `autoupdate` headers. Its commit message says this makes "the signature rows stay the only copy". But three other marketplace handlers whose `USAGE` comes from `marketplaceUsage(...)` still write the signature in their headers:

- `` `/claude:plugin marketplace <list|ls> [--scope user|project]` ``
- `` `/claude:plugin marketplace update [<name>] [--scope user|project]` ``
- `` `/claude:plugin marketplace info <name> [--scope user|project]` ``

Today these match the rows, so nothing is wrong yet. But they are the same unchecked third copy that the earlier IN-01 described, and they will drift the first time one of these rows gets a flag.

**Fix:** Use the same wording as the fixed headers. For example, for `list.ts`: "Thin-shim factory for `marketplace list`; its usage line comes from `marketplaceUsage("list")`."

---

_Reviewed: 2026-10-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
