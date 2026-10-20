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
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-10-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

I reviewed the phase diff (`15fdfe83..HEAD`) against D-01 to D-06 and USE-01 to USE-08. I traced each changed parser path through `tokenizeArgs`, `parseArgs`, `extractLocalFlag`, `parseCommandArgs`, `openMarketplaceCommand`, `makeSingleNameMarketplaceHandler`, `parsePluginRef`, and `parsePluginTarget`.

The behavior matches the decisions:

- Quoted empty and blank values survive the tokenizer and the `--local` residual rebuild, so they reach the label check.
- An omitted required positional still collapses to `Missing required argument.`.
- `--scope --local` reaches `parseArgs` as an invalid value.
- `@` and a blank `@<name>` on `update`, `fetch`, and `reinstall` report the empty marketplace name.
- `install`, `info`, `uninstall`, `enable`, and `disable` keep the invalid-ref message for `@`.
- The help text keeps its alias column alignment.
- Handler modules import a value from `router.ts`, and `router.ts` imports only `shared/notification-dispatch.ts`, so module evaluation order has no TDZ hazard.

I found no correctness defect in the phase's stated scope. There are two robustness and maintainability gaps:

- The D-02 single-definition refactor leaves the verb inventory hand-copied in several places, and the open-closed doc now understates that.
- The new trim-based empty rule covers only a whole-value blank, not a blank half of a reference.

## Structural Findings (fallow)

All six findings provided are in files outside this review's scope. Each is pre-existing and gated by an inline marker in `npm run fallow`. None involves a scoped file.

| Type | File | Line | Related file |
| --- | --- | --- | --- |
| duplicate_block (3 instances) | `extensions/pi-claude-marketplace/persistence/migrate.ts` | 106 | same file |
| duplicate_block (2 instances) | `extensions/pi-claude-marketplace/persistence/migrate.ts` | 168 | same file |
| duplicate_block (2 instances) | `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts` | 319 | `orchestrators/reconcile/apply-outcomes.ts` |
| duplicate_block (2 instances) | `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | 2191 | same file |
| duplicate_block (2 instances) | `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` | 1125 | `orchestrators/plugin/uninstall.ts` |
| duplicate_block (2 instances) | `tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts` | 284 | same file |

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: The marketplace verb inventory is still hand-copied, and the open-closed doc now says one row is enough

**File:** `extensions/pi-claude-marketplace/edge/router.ts:131-132`, `:166`, `:128`; `docs/open-closed-proof.md:20`

**Issue:** D-02 builds each verb's help line and its `Usage:` line from one `MARKETPLACE_VERB_SIGNATURES` row. But the verb set itself is still written by hand in four places:

- the `MarketplaceVerb` union (`:131-132`);
- the help header literal `<add|remove|rm|list|ls|info|update|autoupdate|noautoupdate>` inside `marketplaceHelp()` (`:166`);
- the same literal in `TOP_LEVEL_USAGE` (`:128`);
- `MARKETPLACE_SUBCOMMANDS` with the router switch.

The aliases are also stated twice: once in the signature rows (`alias: "rm"`) and once in the header literal and the `case "rm":` arm.

`docs/open-closed-proof.md:20` now says that "a new marketplace verb adds one `MARKETPLACE_VERB_SIGNATURES` row, which builds both its line in the marketplace help and its own usage line". In fact the row does not compile until the `MarketplaceVerb` union also changes, because `Record<MarketplaceVerb, …>` rejects the extra key. The header literal is never checked against the rows.

`router.test.ts` pins the whole help string, so a new row turns that test red. A developer who pastes the new output into `EXPECTED_MARKETPLACE_USAGE` then gets a header that leaves out the new verb, and no test fails. That is the kind of drift D-02 was meant to prevent.

**Fix:** Derive the type and the header from the rows. Then a new verb is a single edit apart from the switch arm, and the doc's statement becomes true.

```ts
const MARKETPLACE_VERB_SIGNATURES = {
  add: { args: "<source> [--scope user|project] [--local]" },
  remove: { alias: "rm", args: "<name> [--scope user|project] [--local]" },
  // ...
} as const satisfies Record<string, MarketplaceVerbSignature>;

export type MarketplaceVerb = keyof typeof MARKETPLACE_VERB_SIGNATURES;

const MARKETPLACE_SPELLINGS = Object.entries(MARKETPLACE_VERB_SIGNATURES)
  .flatMap(([verb, sig]) => ("alias" in sig ? [verb, sig.alias] : [verb]))
  .join("|");
// header: `Usage: /claude:plugin marketplace <${MARKETPLACE_SPELLINGS}> ...`
```

Also update the doc bullet so it names every edit a new marketplace verb still needs, including the switch `case`. Alternatively, add a unit test asserting that the header's spelling list equals `MARKETPLACE_SUBCOMMANDS` minus `help`.

### WR-02: A blank half of a plugin reference passes edge validation and gets neither the empty-field message nor the invalid-ref message

**File:** `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts:29-38`, `:47-67`, `:89-101`

**Issue:** The phase brings in the trim-based rule `<Field> must not be empty.` (USE-07). It applies that rule only when the whole token is blank (`ref.trim() === ""`, and `marketplace.trim() === ""` after a leading `@`). `splitPluginMarketplaceRef` still tests only the raw index of the `@` (`atIdx <= 0 || atIdx === ref.length - 1`). So a quoted reference whose plugin or marketplace half is only whitespace is accepted as a valid ref:

- `install ' @official'` gives `{ plugin: " ", marketplace: "official" }`.
- `update 'alpha@  '` gives `{ plugin: "alpha", marketplace: "  " }`. `update`, `fetch`, and `reinstall` take the `parsePluginRef` branch here, because the token does not start with `@`.

By contrast, `alpha@` with an empty half is rejected as `Invalid <plugin>@<marketplace> ref: "alpha@".`, and `'@   '` is rejected as `Marketplace name must not be empty.`. Each blank variant behaves differently from its empty twin. It reaches the orchestrator and fails there as an entity error, either `assertSafeName`'s `must be a non-empty string` or a not-added marketplace, instead of a usage error with the verb's usage line. D-06 keeps "partly malformed" refs on the invalid-ref message, but these inputs never get that message. No test covers a blank half: `parsePluginRef`'s table in `tests/edge/handlers/plugin/shared.test.ts` has `alpha@` and `@official` but no `' @official'` or `'alpha@ '`.

**Fix:** Make the split reject a blank half, so a blank half follows its empty twin onto the invalid-ref message as D-06 asks. Add the two rows to the `parsePluginRef` and `parsePluginTarget` tables.

```ts
function splitPluginMarketplaceRef(ref: string): PluginMarketplaceRef | undefined {
  const atIdx = ref.indexOf("@");
  if (atIdx <= 0 || atIdx === ref.length - 1) {
    return undefined;
  }

  const plugin = ref.slice(0, atIdx);
  const marketplace = ref.slice(atIdx + 1);
  if (plugin.trim() === "" || marketplace.trim() === "") {
    return undefined;
  }

  return { plugin, marketplace };
}
```

## Info

### IN-01: The handler header comments still state the old usage, without `[--local]`

**File:** `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts:4`, `remove.ts:4`, `autoupdate.ts:135-137`

**Issue:** These files now take `USAGE` from `marketplaceUsage(...)`. Their file-header comments still spell the signature by hand without `[--local]`:

- `` `/claude:plugin marketplace add <source> [--scope user|project]` ``
- `` `<remove|rm> <name> [--scope user|project]` ``
- `` `autoupdate [<name>] [--scope user|project]` ``, and the same for `noautoupdate`

That is the D-01 drift again, in a third copy that nothing checks.

**Fix:** Drop the flag list from each header, for example "Thin-shim handler factory for `marketplace add`; its usage line comes from `marketplaceUsage("add")`". If the header keeps the flags, add `[--local]`.

### IN-02: An edited header comment in `info.test.ts` was not reflowed

**File:** `tests/edge/handlers/marketplace/info.test.ts:9`

**Issue:** The rewrite left one comment line 143 characters long, and the line two above it at 54 characters. Prettier does not reflow comments, and the file's other comment lines stay under 80 characters.

**Fix:** Reflow lines 6-10 to the file's width.

---

_Reviewed: 2026-10-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
