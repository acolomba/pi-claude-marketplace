# Phase 8: Marketplace Help and Usage Errors - Pattern Map

**Mapped:** 2026-10-20
**Files analyzed:** 33 (new + modified)
**Analogs found:** 33 / 33 (every file is an edit of an existing file or has a sibling analog)

All paths below are git-tracked (`extensions/`, `tests/`, `features/`). Paths are relative to the repo root.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/edge/router.ts` (D-01/D-02: signature table, `marketplaceUsage`, `MarketplaceVerb`, rebuilt `MARKETPLACE_USAGE`) | config/utility | transform | itself, `MARKETPLACE_USAGE` at `router.ts:129-137`; RESEARCH Pattern 1 sketch | exact |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/{add,remove,list,info,update,autoupdate}.ts` (USAGE -> `marketplaceUsage(...)`; pass labels) | controller | request-response | `autoupdate.ts:23-27` (`usageFor`) | exact |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts` (`openMarketplaceCommand` gains `positionalLabel`; `makeSingleNameMarketplaceHandler` labels `Marketplace name`) | utility | request-response | itself `:107-139`, `:51-81` | exact |
| `extensions/pi-claude-marketplace/edge/args-schema.ts` (D-05: required `label`, empty != omitted) | utility (validator) | transform | itself `:40-112` | exact |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` (`parseRequiredPluginMarketplaceRef` label `Plugin name`) | utility | request-response | itself `:140-180` | exact |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` (D-06 `""`) | controller | request-response | `plugin/install.ts:69-87` | exact |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts` (D-06 `""`) | controller | request-response | `plugin/info.ts:53-68` | exact |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` (D-06 `""`, `@`) | controller | request-response | `plugin/update.ts:47-71` | exact |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts` (D-06 `""`, `@`) | controller | request-response | `plugin/fetch.ts:89-111` `parseFetchTarget` | exact |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` (D-06 `""`, `@`) | controller | request-response | `plugin/reinstall.ts:70-93` `parseTarget` | exact |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` (D-06 `list ""` rejected) | controller | request-response | `plugin/list.ts:58-61` (Too many arguments arm) | exact |
| `tests/edge/router.test.ts` | test | - | itself, literal `EXPECTED_MARKETPLACE_USAGE` `:287-295` | exact |
| `tests/architecture/flag-catalog-drift.test.ts` (flip 4 pins `:257-263`) | test | - | itself | exact |
| `tests/edge/args-schema.test.ts` | test | - | itself `:121-140, :165-185, :315-335` | exact |
| `tests/edge/handlers/marketplace/{add,info,remove,update,autoupdate,shared}.test.ts` | test | - | themselves (row tables) | exact |
| `tests/edge/handlers/plugin/{shared,install,info,update,fetch,reinstall,list}.test.ts` | test | - | `reinstall.test.ts:898-920` (empty-target loop) | exact |
| `features/marketplace/help.feature` (D-01 cell; USE-01 `help marketplace`; USE-02 x2) | test (behavioral) | request-response | itself `:6-21` | exact |
| `features/marketplace/usage-errors.feature` (NEW, USE-03..07) | test (behavioral) | request-response | `help.feature:14-21` + Outline shape `autoupdate.feature:602-615` | role-match |
| `features/plugin/*.feature` (optional D-06 rows; none pin today) | test (behavioral) | request-response | `features/plugin/uninstall.feature` | role-match |
| `CHANGELOG.md` `[Unreleased]` | docs | - | existing `[Unreleased]` bullets, `.agents/skills/changelog/SKILL.md` | exact |

No `docs/output-catalog.md` / `EXPECTED_UTF8_BYTES` change (RESEARCH Pitfall 4: no catalog bytes carry these strings; grep of `docs/` confirms no `Invalid <plugin>@`, `must not be empty`, or `Missing required` text).

## Pattern Assignments

### `edge/router.ts` (D-02, then D-01)

Today (`router.ts:129-137`) -- the literal to rebuild byte-for-byte first:
```typescript
export const MARKETPLACE_USAGE =
  "Usage: /claude:plugin marketplace <add|remove|rm|list|ls|info|update|autoupdate|noautoupdate> ...\n" +
  "  add <source> [--scope user|project]\n" +
  "  remove <name> [--scope user|project]   (alias: rm)\n" +
  "  list [--scope user|project]            (alias: ls)\n" +
  ...
```
Use RESEARCH Pattern 1 verbatim (typechecked + fallow-clean): exported `MarketplaceVerb` union (non-export trips fallow `private-type-leaks`), private `Record<MarketplaceVerb, {alias?, args}>` table, `marketplaceUsage(verb)`, alias column = longest aliased line + 3. Use `Record` lookup, never `Array.find` (unreachable `undefined` arm under 100% coverage, no `!`/`as`). Router must not import handlers (cycle; handlers `import type { SubcommandHandler } from "../../router.ts"`, `help.ts:8` already value-imports `MARKETPLACE_USAGE`).

### Marketplace handlers (consumers of `marketplaceUsage`)

Analog `handlers/marketplace/autoupdate.ts:18-47`:
```typescript
import type { SubcommandHandler } from "../../router.ts";

function usageFor(enable: boolean): string {
  return enable
    ? "Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user|project] [--local]"
    : "Usage: /claude:plugin marketplace noautoupdate [<name>] [--scope user|project] [--local]";
}
...
    const parsed = parseCommandArgs(
      localFlag.residualArgs,
      {
        positional: [{ name: "name", required: false }] as const,
        usage,
      },
      (message) => {
        notifyUsageError(ctx, run, { message, usage });
      },
    );
```
Change: `const usage = marketplaceUsage(enable ? "autoupdate" : "noautoupdate");` (drop `usageFor`; the `import type` becomes a value import of `marketplaceUsage` plus `type SubcommandHandler`), positional gains `label: "Marketplace name"`. Keep the existing `fallow-ignore-next-line code-duplication` marker above the returned closure; if lines shift, re-run `npx fallow dupes` per CONVENTIONS. Same edit shape in `add.ts:26`, `remove.ts:23-24`, `list.ts:21`, `info.ts:16`, `update.ts:33,39-53` (label `Marketplace name`).

### `handlers/marketplace/shared.ts` `openMarketplaceCommand` (`:107-139`)

```typescript
  opts: { usage: string; positionalName: N },
...
      positional: [{ name: opts.positionalName }] as const,
...
        message: message === opts.usage ? "Missing required argument." : message,
```
Add `positionalLabel: string` to `opts` beside `positionalName`, pass `label: opts.positionalLabel`. Callers: `add.ts:32-35` -> `"Source"`, `remove.ts:28-31` -> `"Marketplace name"`. `makeSingleNameMarketplaceHandler` (`:51-81`): literal `label: "Marketplace name"` (only caller is `info`). Keep the `message === usage` mapping (USE-03 omitted path).

### `edge/args-schema.ts` (D-05)

Current loop (`:93-110`) -- required empty goes to `onError(schema.usage)`, optional empty to `"Argument must not be empty."`:
```typescript
    if (required) {
      if (value === undefined || value.trim() === "") {
        onError(schema.usage);
        return undefined;
      }
      out[entry.name] = value;
    } else if (value !== undefined) {
      if (value.trim() === "") {
        onError("Argument must not be empty.");
```
Replace with RESEARCH Pattern 2: `PositionalSpec` gains required `readonly label: string` (`:40-44`); `undefined` -> usage only when required; `trim() === ""` -> `` `${entry.label} must not be empty.` `` for both arms. Keep order parseArgs -> unknown flag -> too many -> per-positional. Watch both complexity gates (15) -- the flatter form is lower than today.

### `handlers/plugin/shared.ts` (`:140-180`)

```typescript
      positional: [{ name: "ref" }] as const,
...
      const head = message === usage ? "Missing required argument." : message;
```
Add `label: "Plugin name"`. Reaches `uninstall` (`uninstall.ts:45`), `enable`/`disable` (`enable-disable.ts:47`). `splitPluginMarketplaceRef` (`:29-40`) stays unchanged (it already returns `undefined` for `""`, `@`, `@mp`, `foo@`).

### D-06 plugin verbs outside the parser

The empty check goes **before** `splitPluginMarketplaceRef` at each site. Change points:

| Verb | File:lines | Insert check | Label(s) | Placeholder in USAGE |
|---|---|---|---|---|
| install | `plugin/install.ts:77-86` (after the "exactly one" check `:69-75`) | `positional.trim() === ""` -> `Plugin name must not be empty.` | Plugin name | `<plugin>@<marketplace>` |
| info | `plugin/info.ts:61-67` (after `:53-59`) | same | Plugin name | `<plugin>@<marketplace>` |
| update | `plugin/update.ts:55-66` branch chain `ref === undefined` / `startsWith("@") && length > 1` / split | add `ref.trim() === ""` -> Plugin name; `ref === "@"` -> `Marketplace name must not be empty.` | Plugin name, Marketplace name | `[<plugin>@<marketplace> \| @<marketplace>]` |
| fetch | `plugin/fetch.ts:94-110` `parseFetchTarget` | same two arms | same | same |
| reinstall | `plugin/reinstall.ts:75-91` `parseTarget` | same two arms | same | same |
| list | `plugin/list.ts:58-61` (beside `Too many arguments.`) | `nonFlagPositionals[0]?.trim() === ""` -> `Marketplace name must not be empty.` (avoid optional-chain branch that 100% branch coverage cannot reach; test `""` and a non-empty value) | Marketplace name | `[<marketplace>]` |

Analog arm to copy (`plugin/fetch.ts:98-108`, identical shape in update/reinstall):
```typescript
  if (ref.startsWith("@") && ref.length > 1) {
    return { kind: "marketplace", marketplace: ref.slice(1) };
  }

  const split = splitPluginMarketplaceRef(ref);
  if (split === undefined) {
    notifyUsageError(ctx, run, {
      message: `Invalid <plugin>@<marketplace> ref: "${ref}".`,
      usage: USAGE,
    });
    return undefined;
  }
```
`fetch`, `update`, `reinstall` now duplicate the same 3-arm target parse; adding two more arms to each enlarges the clone. Consider one helper in `plugin/shared.ts` (e.g. `emptyTargetMessage(ref): string | undefined`) to keep `fallow dupes` (threshold 3) and the `fallow-audit` warn gate green -- planner's choice.

**Open points for the planner (D-06 says "values empty as a whole"):**
- `@` on `install`/`info` (whose only form is `<plugin>@<marketplace>`): stays `Invalid ... ref: "@".` or becomes Plugin/Marketplace name? Not settled by D-06; recommend keeping `Invalid` (partly malformed) and stating it.
- `"   "` (whitespace) should follow D-05's `trim()` rule for consistency.
- `@mp` on install (`install.test.ts:719`) and `foo@` / `alpha@` stay `Invalid ... ref`.

## Tests that pin the old messages (must change in the same commit)

D-05 (from RESEARCH Pitfall 2, re-verified by grep):
- `tests/edge/args-schema.test.ts` `:121-140`, `:165-185`, `:315-335`; every schema literal needs `label`. `:187-212` (whole-string `""`/`"   "` = no token) stays.
- `tests/edge/handlers/marketplace/add.test.ts:531-532` -> `Source must not be empty.` (`:527-528` stays).
- `info.test.ts:324-325`, `remove.test.ts:396-397` -> `Marketplace name must not be empty.`
- `update.test.ts:490`, `:618-619`; `autoupdate.test.ts:447-448`, `:497-498` -> `Marketplace name must not be empty.`
- `marketplace/shared.test.ts` (`:122,334,405,417` omitted rows stay) -- add `""` rows for both helpers.
- `plugin/shared.test.ts` -- add `""` -> `Plugin name must not be empty.` (`:355` omitted stays); `uninstall.test.ts:668,892`, `enable-disable.test.ts:387,783,837` are omitted rows, unchanged.

D-06:
- `tests/edge/handlers/plugin/reinstall.test.ts:898-920` -- loop over `['""', "''", '--local ""', "'' --local"]` expects `Invalid <plugin>@<marketplace> ref: "".`; becomes `Plugin name must not be empty.`. This loop is the template for new install/info/update/fetch/list rows:
```typescript
for (const args of ['""', "''", '--local ""', "'' --local"]) {
  test(`rejects an empty supplied target without reinstalling any plugin: ${args}`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "empty-target");
    ...
    assert.deepStrictEqual(notifications, [
      {
        message: `Invalid <plugin>@<marketplace> ref: "".\n\n${REINSTALL_USAGE}`,
        severity: "error",
      },
    ]);
```
- `reinstall.test.ts:730` row `{ label: "lone-separator", reference: "@", ... }` -> Marketplace name message.
- `fetch.test.ts:153-156` (`args: "@"`) -> `Marketplace name must not be empty.\n\nUsage: /claude:plugin fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]`.
- `update.test.ts:990` (`ref: "@"`) -> Marketplace name message.
- `install.test.ts:707-730`, `info.test.ts`, `list.test.ts`, `update.test.ts`, `fetch.test.ts`: add `""` rows (none exist today). Keep `no-at-sign`, `@mp`, `alpha@`, `foo@` rows.
- No `features/plugin/*.feature` scenario pins any of these messages (grep: none).

D-01:
- `tests/architecture/flag-catalog-drift.test.ts:257-263` -- flip `"marketplace add" | "marketplace remove" | "marketplace autoupdate" | "marketplace noautoupdate"` from `{ documented: [], omitted: ["--local"] }` to `{ documented: ["--local"], omitted: [] }` (read via `usageLineFor`, `:274`).
- `tests/edge/router.test.ts:287-295` literal `EXPECTED_MARKETPLACE_USAGE` -> after-D-01 text (RESEARCH "Exact texts"); USE-02 cases `:691,732,752,758` follow. Add literal per-verb `marketplaceUsage` cases (alias and no-alias arms); never compute the expectation from the builder.

## Behavioral scenarios

### `features/marketplace/help.feature` (modify)

Existing scenario (`:6-12`) is the template; only the `usage` cell changes to the RESEARCH D-01 cell (escape `|` as `\|`, newline as `\n`). New single scenarios (USE-01 `help marketplace`; USE-02 bare `marketplace` and `marketplace bogus`) copy `:14-21`:
```gherkin
  Scenario: Marketplace help with an argument is rejected
    When the user runs "/claude:plugin marketplace help extra"
    Then the result has these fields:
      | kind         | usage-error                            |
      | severity     | error                                  |
      | needs reload | false                                  |
      | message      | marketplace help takes no arguments.   |
      | usage        | Usage: /claude:plugin marketplace help |
```

### `features/marketplace/usage-errors.feature` (new)

- `Feature: Marketplace usage errors` (title must kebab to the file name, `scripts/check-features.mjs:312-326`) + 2-3 line description, as `help.feature:3-4`.
- One `Scenario Outline` per D-03 kind, 3+ rows (`.agents/skills/cucumber/rules/features.md:34-35`), descriptive placeholders (`<arguments>`, `<message>`, `<usage>`), untagged `Examples:` only (no `@url`/`@github` - no source kind here). Outline shape from `features/marketplace/autoupdate.feature:602-615`:
```gherkin
  Scenario Outline: ...
    When the user runs "/claude:plugin marketplace <verb> <name>"
    Then the result has these fields:
      | kind         | ...      |
      | severity     | error    |
      | needs reload | false    |
```
  Each row states `kind`, `severity`, `needs reload`, `message`, `usage` (whole payload; `command.steps.ts:92-99,124-129` fail on unstated fields). Row inventory: RESEARCH "Scenario inventory". Empty arguments in cells use `''` (or `\"\"`) inside the double-quoted step string. One fault per row (Pitfall 3).
- No new step, world member, or `features/lib` module.

## Shared Patterns

### Usage-error output
**Source:** `notifyUsageError(ctx, run, { message, usage })` from `shared/notification-dispatch.ts` -- every handler above. Never `ctx.ui.notify` (fallow `notify-chokepoint`).

### Missing vs empty
**Source:** the `message === usage ? "Missing required argument." : message` mapping at `marketplace/shared.ts:64,126`, `plugin/shared.ts:157`. Keep it unchanged; D-05 only changes what `parseCommandArgs` sends for an explicit empty.

### Test layout
**Source:** `.agents/skills/typescript-unit-tests/SKILL.md`; table-driven `for (const ... of [...]) test(...)` with `// arrange / act / assert` (`reinstall.test.ts:898-920`), hermetic workspace for handler tests that touch scopes, literal expected strings.

### Comments
Cite D-05/D-06/USE-07 only where the why is non-obvious; no phase/plan references.

## No Analog Found

None. The only new file (`usage-errors.feature`) has direct sibling analogs.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/edge/**`, `tests/edge/**`, `tests/architecture/flag-catalog-drift.test.ts`, `features/**`, `docs/`
**Files scanned:** ~30
**Pattern extraction date:** 2026-10-20
