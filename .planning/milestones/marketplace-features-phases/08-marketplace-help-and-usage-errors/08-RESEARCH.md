# Phase 8: Marketplace Help and Usage Errors - Research

**Researched:** 2026-10-20
**Domain:** edge-layer argument parsing and help text (`edge/router.ts`, `edge/args-schema.ts`, `edge/handlers/**`) plus real-Pi cucumber scenarios
**Confidence:** HIGH (every behavior claim below was read from source this session or observed against a real headless Pi at `124f2311`)

## Summary

The phase is mostly scenario work on behavior that already exists, plus two small production changes. I ran 119 commands against a real headless Pi (the `features/lib/pi-process.ts` driver in a scratch sandbox) and recorded what each rejection reports today. Every marketplace rejection kind that D-03 lists already works, with one exception. An explicitly empty argument reports `Missing required argument.` (`add`, `remove`, `info`) or `Argument must not be empty.` (`update`, `autoupdate`, `noautoupdate`). D-05 replaces both messages. The help block is the only other text that changes (D-01).

D-02 fits in `edge/router.ts` as a private signature table, one exported `marketplaceUsage(verb)` builder, and `MARKETPLACE_USAGE` built from the same table. I ran this exact shape in a scratch copy of the tree. It typechecks, `fallow dead-code` and `fallow health` pass once the verb union type is exported, and it rebuilds today's help text and all seven per-verb `Usage:` lines byte for byte. With D-01's `[--local]` added, one more byte change cannot be avoided. The `list` line's padding grows by 10 spaces, because the alias column follows the longer `remove` line. Keeping the column aligned is what D-02 asks for.

Three facts in CONTEXT.md do not match the tree. (1) `docs/output-catalog.md` has no marketplace help entry and no per-verb usage-error text. Neither D-01 nor D-05 changes the catalog or `EXPECTED_UTF8_BYTES`. (2) `tests/architecture/flag-catalog-drift.test.ts:257-263` pins `--local` as **omitted** from the `add`, `remove`, `autoupdate`, and `noautoupdate` help lines. D-01 must flip those four pins in the same commit, and that test is the unit-level RED for D-01. (3) Only `uninstall`, `enable`, and `disable` among the plugin verbs use `parseCommandArgs`. `install`, `update`, `fetch`, `reinstall`, and `info` reject `""` as `Invalid <plugin>@<marketplace> ref: "".`. Plugin `list ""` is accepted and lists nothing. No plugin feature scenario pins any of these messages.

**Primary recommendation:** Run three plans in sequence. (1) D-02 refactor, byte-identical, then D-01 test-first, plus the help scenarios (USE-01/02/08). (2) A new `features/marketplace/usage-errors.feature` with the rejection Outlines that pass today (USE-03..06). (3) D-05 test-first: add a required `label` to `PositionalSpec`, then the empty-argument Outline (USE-07), and update every unit test that pins the old messages, all in one commit.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Help text

- **D-01 (user):** Fix the `marketplace help` text (`MARKETPLACE_USAGE` in
  `extensions/pi-claude-marketplace/edge/router.ts`) so its `add`, `remove`,
  `autoupdate`, and `noautoupdate` lines show `[--local]`. Each must match the
  verb's own usage line. For example, `add` rejects with
  `Usage: /claude:plugin marketplace add <source> [--scope user|project] [--local]`.
  Write it test-first: the help scenario fails on today's text, then passes.
  The `docs/output-catalog.md` entry and its byte-count constant change in the
  same commit.
- **D-02 (user):** Define each marketplace verb's argument signature once.
  Build both the verb's line in the help and its own `Usage:` line from that
  one definition, so a new flag cannot reach one and miss the other. This is a
  small refactor in the edge layer with paired unit tests. The planner chooses
  the shape, for example a signature table in the router or an export from
  each handler module. The help text keeps its current layout, including the
  alias notes and column alignment, except for the D-01 change.

#### Rejection coverage

- **D-03 (user):** Cover every verb for each rejection kind. Write one
  Outline per kind, with a row for every marketplace verb that can produce it.
  Each row compares the whole `usage-error` payload: kind, severity, needs
  reload, message, and the verb's own usage line. The kinds:
  - **Missing required argument** (USE-03): `add`, `remove`, `info`, reporting
    `Missing required argument.`
  - **Surplus arguments** (USE-04): every verb, reporting `Too many arguments.`
  - **Unknown flag** (USE-05): every verb, reporting `Unknown flag: "<flag>".`,
    including `--local` on `list`, `info`, and `update`.
  - **Bad `--scope` value** (USE-06): every verb, reporting
    `Invalid --scope value: "<x>". Must be "user" or "project".`
  - **Missing `--scope` value** (USE-06): every verb, reporting
    `--scope requires a value: "user" or "project".`
  - **Empty argument** (USE-07, with D-05's wording): `add`, `remove`, `info`,
    `update`, `autoupdate`, and `noautoupdate`.
- **D-04 (user):** Cover `--scope` positions once per parser path. Every verb
  gets one bad-value row and one missing-value row. Add rows with `--scope`
  before the positional, after it, and at the end with no value, for one verb
  of each of the three parser paths:
  - `add`, `remove`, `info` (the shared open-command helper in
    `edge/handlers/marketplace/shared.ts`)
  - `list`, `update` (`parseCommandArgs` directly)
  - `autoupdate`, `noautoupdate` (`extractLocalFlag` strips `--local` first)

#### Empty-value errors

- **D-05 (user):** An explicitly empty argument is an input-value validation
  error. Its message names the field: `<Field> must not be empty.` This applies
  to required and optional arguments alike, and to every verb that shares the
  parser:
  - `Source must not be empty.`: `marketplace add ""`.
  - `Marketplace name must not be empty.`: `marketplace remove ""`,
    `info ""`, `update ""`, `autoupdate ""`, and `noautoupdate ""`.
  - `Plugin name must not be empty.`: the plugin verbs that take
    `<plugin>@<marketplace>`.
  - An omitted required argument keeps `Missing required argument.` (USE-03).
    That is an absence, not a value error.

  This replaces both today's `Missing required argument.` for an empty
  required argument and the generic `Argument must not be empty.` for an empty
  optional one. Write it test-first. Update the plugin verbs' scenarios, the
  unit tests, and the catalog entries that state the old messages.
  A positional that has no obvious label (a plugin verb's `@<marketplace>`
  form, for instance) takes its label from the placeholder its usage line
  prints. The planner lists each label. — **Reversibility:** costly — it
  changes the documented catalog bytes and the `usage-error` JSON `message`
  across both the marketplace and the plugin verbs, so undoing it touches the
  catalog, the scenarios, and the unit tests again.

#### Pinned as they are (carried forward, not re-asked)

- USE-01: `marketplace help` and `help marketplace` both return `usage-info`
  with the marketplace usage. `help help` and a bare `help` show the top-level
  usage.
- USE-02: a bare `marketplace` reports `marketplace requires a subcommand.`,
  and an unknown subcommand reports `Unknown marketplace subcommand: "<x>".`.
  Both show the marketplace usage.
- USE-08: `marketplace help extra` reports
  `marketplace help takes no arguments.` with
  `Usage: /claude:plugin marketplace help`. The existing scenario stays.
- A rejection shows the verb's own usage line, not the whole marketplace
  usage. Phase 1 set the whole-payload comparison.

### Claude's Discretion

- Whether the `rm` and `ls` aliases get rows of their own in the rejection
  Outlines. RM-07 and LS-04 already pin that the aliases succeed the same way.
- Whether to pin a flag given as the `--scope` value (`--scope --local`, which
  reads as an invalid value), and `help marketplace extra` (today
  `Unknown help topic: "marketplace extra".`).
- Outline titles and table layout, within `.agents/skills/cucumber/rules/`.
  Each Outline needs three or more rows.
- How the plan splits the work. D-01 depends on D-02. The D-05 parser change
  lands with every scenario, test, and catalog entry it changes, so the
  commit hook stays green.

### Deferred Ideas (OUT OF SCOPE)

- The top-level `/claude:plugin help` (`TOP_LEVEL_USAGE`) has drifted the same
  way. It omits `[--local]`, `--map-model`, and `--partial` on `install`,
  `update`, and `reinstall`, which those verbs' own usage lines show. That is
  plugin help, outside this phase, and a candidate for its own change applying
  the D-02 single-source pattern.
- The plugin `list` verb reports an unknown flag as `Unknown option: "<x>".`,
  but the marketplace verbs say `Unknown flag: "<x>".`. This is a plugin-family
  wording inconsistency, outside this phase.
- `.planning/todos/pending/2026-10-13-cucumber-rules-trial.md`: porting the
  cucumber skills to another repository is outside this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| USE-01 | `marketplace help` and `help marketplace` show the marketplace usage | Both return `usage-info` with `MARKETPLACE_USAGE` today (probe). `help.ts` imports `MARKETPLACE_USAGE` from `router.ts`. Expected text after D-01 is under "Exact texts". |
| USE-02 | `marketplace` with no subcommand, or an unknown one, shows the usage with a reason | `router.ts:243-248` and `router.ts:290-295` (probe: `marketplace requires a subcommand.`, `Unknown marketplace subcommand: "bogus".`, usage = whole help block). |
| USE-03 | `add`, `remove`, `info` without their argument fail as `Missing required argument.` | Probe: all three report that with their own usage line. D-05 must keep the omitted path (value `undefined`). |
| USE-04 | Surplus arguments are rejected | Probe: every verb reports `Too many arguments.` (`args-schema.ts:88-91`). |
| USE-05 | Unknown flags are rejected, including `--local` on `list`, `info`, `update` | Probe: `Unknown flag: "--bogus".` and `Unknown flag: "--local".`. Two code paths (`handlers/shared.ts:207-210`, `args-schema.ts:82-86`). |
| USE-06 | A bad or missing `--scope` value is rejected in any position | Probe: both messages, every verb, before/after/end (`args.ts:45-54`). |
| USE-07 | An explicitly empty optional argument (`update ""`, `autoupdate ""`) is rejected | Rejected today with `Argument must not be empty.`. D-05 changes it to `Marketplace name must not be empty.`. |
| USE-08 | `marketplace help` with an argument is rejected | Existing scenario `help.feature:14-21` passes today. Keep it unchanged. |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Read before editing; trace callers first. Never commit to `main`. Never rebase. Never use `--no-verify`.
- Commits follow `.agents/skills/committing/SKILL.md`, using Conventional Commits with no phase numbers in titles.
- `npm run check` is the gate for waves, the phase, and merges. A green pre-commit hook (`check:commit`) is not a full verdict. It runs `check:static`, the unpaired tests (incl. `tests/architecture/**`), and direct coverage only for the **staged** source-test pairs. It does **not** run cucumber.
- 100% direct line, function, and branch coverage per source-test pair. No coverage ignores. Every production module has exactly one paired test.
- Two complexity gates: ESLint `sonarjs/cognitive-complexity: 15` and fallow `maxCognitive: 15` / `maxCyclomatic: 20`.
- fallow `rules["private-type-leaks"]: "error"` (`.fallowrc.json:154`). An exported function whose signature names a same-file private type fails.
- Output only through `notifyUsageError` / `notifyUsageInfo` (`shared/notification-dispatch.ts`). No direct `ctx.ui.notify`.
- Every plan SUMMARY.md includes `## Threat Flags`.
- Comments cite durable IDs (D-NN, USE-NN), never phase/plan numbers. No comments on trivial code.
- Upstream parity: CONTEXT records that no Claude Code position applies. The `/claude:plugin` help and usage text belong to Pi.
- Tests that touch user scope use a hermetic home. Cucumber scenarios already run in a temp sandbox (`features/support/pi-process.ts:47-62`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Help text and per-verb `Usage:` lines (D-01/D-02) | edge (`edge/router.ts`) | edge handlers (consumers) | Router already owns `MARKETPLACE_USAGE`; handlers already import from it (`help.ts:8`). Router imports no handler, so no cycle. |
| Tokenizing, `--scope` validation | edge (`edge/args.ts`) | — | Unchanged. |
| Unknown-flag / surplus / missing / empty checks (D-05) | edge (`edge/args-schema.ts`) | edge handlers (pass labels) | The one shared positional validator. |
| `--local` pre-scan | edge (`edge/handlers/shared.ts` `extractLocalFlag`) | — | Unchanged. It decides precedence on its path (see Pitfall 3). |
| Rendering `usage-error` / `usage-info` payloads | shared (`notification-dispatch.ts`) | — | Unchanged. |
| Behavioral proof | `features/marketplace/*.feature` | `features/step_definitions/command.steps.ts` | Existing steps compare whole payloads. No new step is needed. |

## Standard Stack

No new dependency. Everything uses tools already in the repo.

| Tool | Version (verified this session) | Purpose |
|------|------|---------|
| `@cucumber/cucumber` | 13.3.0 (`npx cucumber-js --version`) | Behavioral scenarios |
| `node:test` | Node v26.11.1 locally (CI runs Node 24) | Unit tests |
| `fallow` | 3.31.0 | dead-code / health / dupes gate |
| TypeScript | `^6.0.3` strict, `exactOptionalPropertyTypes` | Typecheck |

## Package Legitimacy Audit

None. This phase installs no external package.

## Architecture Patterns

### System flow of a marketplace command

```text
user types "/claude:plugin marketplace <verb> <args>"
        │
        ▼
router.selectClaudePluginRoute ──"marketplace"──► selectMarketplaceRoute
        │                                            │ head==""      → usage-error "marketplace requires a subcommand." + MARKETPLACE_USAGE
        │                                            │ unknown head  → usage-error "Unknown marketplace subcommand: \"x\"." + MARKETPLACE_USAGE
        │                                            │ help + rest   → usage-error "marketplace help takes no arguments." + MARKETPLACE_HELP_USAGE
        │                                            │ help          → handlers.help("marketplace") → usage-info MARKETPLACE_USAGE
        │                                            ▼ add|remove|rm|list|ls|info|update|autoupdate|noautoupdate → handler(rest)
        ▼
handler path A (add, remove/rm): extractLocalFlag → parseCommandArgs (openMarketplaceCommand)
handler path B (info):           parseCommandArgs (makeSingleNameMarketplaceHandler)
handler path C (list/ls, update): parseCommandArgs
handler path D (autoupdate, noautoupdate): extractLocalFlag → parseCommandArgs
        │
        ▼ parseCommandArgs: parseArgs(--scope) → unknown "--" flag → too many → per positional: missing / empty
        ▼
notifyUsageError({ message, usage: <verb's own Usage: line> })  → usage-error payload
```

**Correction to D-04's grouping:** `info` does **not** use `openMarketplaceCommand`. It uses `makeSingleNameMarketplaceHandler`, which has no `extractLocalFlag` (`shared.ts:51-81`). That is why `info a --local` is rejected by `parseCommandArgs` as an unknown flag. In observable precedence, `info` behaves like path C (`list`/`update`), not like `add`/`remove`. [VERIFIED: extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts:51-81, 107-139]

### Pattern 1 (D-02): signature table in `router.ts`, one builder for both surfaces

Put it in `edge/router.ts`, beside `MARKETPLACE_USAGE`, where it lives today. Why there:

- `router.ts` imports only `shared/notification-dispatch.ts` plus types (`router.ts:21-24`). Handlers already `import type { SubcommandHandler } from "../../router.ts"`, and `help.ts:8` already imports values from it. A value import from handlers → router adds no cycle. `register.ts` imports both, and nothing imports `register.ts` back.
- No new file. A new module would need its own paired test file (pairing rule).
- The edge zone is one fallow zone (`.fallowrc.json` `edge: extensions/pi-claude-marketplace/edge/**`), so no boundary rule applies.
- **Do not** export the signature from each handler and import it into the router. The router would then import the handler modules (and through them the orchestrators), and the handlers' `import type ... from "../../router.ts"` would close a type-level cycle.

Shape that I typechecked (`tsc --noEmit` exit 0) and ran through fallow (`dead-code` and `health` both pass) in a scratch copy of the tree:

```typescript
// Source: scratch copy of edge/router.ts, verified this session
export type MarketplaceVerb = "add" | "remove" | "list" | "info" | "update" | "autoupdate" | "noautoupdate";

interface MarketplaceVerbSignature {
  readonly alias?: string;
  readonly args: string;
}

const MARKETPLACE_VERB_SIGNATURES: Readonly<Record<MarketplaceVerb, MarketplaceVerbSignature>> = {
  add: { args: "<source> [--scope user|project] [--local]" },
  remove: { alias: "rm", args: "<name> [--scope user|project] [--local]" },
  list: { alias: "ls", args: "[--scope user|project]" },
  info: { args: "<name> [--scope user|project]" },
  update: { args: "[<name>] [--scope user|project]" },
  autoupdate: { args: "[<name>] [--scope user|project] [--local]" },
  noautoupdate: { args: "[<name>] [--scope user|project] [--local]" },
};

/** The `Usage:` line of one marketplace verb, built from its signature. */
export function marketplaceUsage(verb: MarketplaceVerb): string {
  const { alias, args } = MARKETPLACE_VERB_SIGNATURES[verb];
  const spelling = alias === undefined ? verb : `<${verb}|${alias}>`;
  return `Usage: /claude:plugin marketplace ${spelling} ${args}`;
}

// The help keeps one alias column: three spaces past the longest verb line
// that carries an alias note.
function marketplaceHelp(): string {
  const rows = Object.entries(MARKETPLACE_VERB_SIGNATURES).map(([verb, { alias, args }]) => ({
    line: `  ${verb} ${args}`,
    alias,
  }));
  const aliasColumn =
    Math.max(...rows.filter((row) => row.alias !== undefined).map((row) => row.line.length)) + 3;
  return [
    "Usage: /claude:plugin marketplace <add|remove|rm|list|ls|info|update|autoupdate|noautoupdate> ...",
    ...rows.map(({ line, alias }) =>
      alias === undefined ? line : `${line.padEnd(aliasColumn)}(alias: ${alias})`,
    ),
  ].join("\n");
}

export const MARKETPLACE_USAGE = marketplaceHelp();
```

Notes for the planner:

- **`MarketplaceVerb` must be exported.** I measured the non-exported form in the scratch copy: fallow reported `:147 marketplaceUsage references private type MarketplaceVerb` (Private type leaks, error). The exported form passed: `✓ No issues found`. [VERIFIED: fallow 3.31.0 run on scratch copy]
- The handlers replace their literals: `const USAGE = marketplaceUsage("add");`. In `autoupdate.ts:23-27`, `usageFor(enable)` becomes `marketplaceUsage(enable ? "autoupdate" : "noautoupdate")`, and the `usageFor` function can go. Same for `remove`, `list`, `info`, `update`. `makeSingleNameMarketplaceHandler(usage, op)` keeps its `usage: string` parameter.
- The header line stays a literal (it is not a per-verb signature). Deriving it from the table is optional. `MARKETPLACE_SUBCOMMANDS` stays separate, as today.
- Run with the alias-free D-01 args, the column rule ("longest aliased line + 3") reproduces today's `MARKETPLACE_USAGE` byte for byte. I checked this with a script against the literal at `router.ts:129-137`. So D-02 can land as a byte-identical refactor before D-01.
- Run ESLint on the result. I did not lint the sketch. Prettier may rewrap the `type` line (>100 columns).
- Update `router.ts:10`'s header comment ("PRD-stable strings") only if you change it. `docs/open-closed-proof.md:20` describes adding a verb as "one `*_USAGE` usage-string line". After D-02 it is "one signature row". The doc update is optional, and the doc's line numbers are already stale.

### Pattern 2 (D-05): a required `label` on `PositionalSpec`; empty ≠ omitted

```typescript
// edge/args-schema.ts (proposed)
export interface PositionalSpec<Name extends string = string> {
  readonly name: Name;
  /** Names the argument in `<label> must not be empty.` (D-05). */
  readonly label: string;
  /** Defaults to true; set to false for tail-optional args. */
  readonly required?: boolean;
}
...
for (const [index, entry] of schema.positional.entries()) {
  const value = parsed.positional[index];
  if (value === undefined) {
    if (entry.required !== false) {
      onError(schema.usage); // callers map this to "Missing required argument." (USE-03)
      return undefined;
    }

    continue;
  }

  if (value.trim() === "") {
    onError(`${entry.label} must not be empty.`);
    return undefined;
  }

  out[entry.name] = value;
}
```

- Make `label` **required**, not optional with an `"Argument"` fallback. Then every call site fails to typecheck until it is labelled, and no positional can keep the generic message by accident.
- Whitespace-only values (`"   "`) already count as empty for both arms (`value.trim() === ""`, `args-schema.ts:98,105`). Keep that.
- The callers' `message === usage ? "Missing required argument." : message` mapping stays as it is, at all four sites (`marketplace/shared.ts:64,126`, `plugin/shared.ts:157`).

**Every `parseCommandArgs` call site and its label** [VERIFIED: grep of `parseCommandArgs(` plus Read of each file this session]:

| Call site | Verbs | Positional | Label (D-05) | Today on `""` |
|-----------|-------|-----------|--------------|---------------|
| `marketplace/shared.ts:118-130` `openMarketplaceCommand` (needs a new `positionalLabel` opt beside `positionalName`) | `add` (`add.ts:32-35`) | `source` (required) | `Source` | `Missing required argument.` |
| same | `remove`/`rm` (`remove.ts:28-31`) | `name` (required) | `Marketplace name` | `Missing required argument.` |
| `marketplace/shared.ts:56-68` `makeSingleNameMarketplaceHandler` | `info` | `name` (required) | `Marketplace name` (literal in the helper, its only caller is `info`) | `Missing required argument.` |
| `marketplace/update.ts:39-53` | `update` | `name` (optional) | `Marketplace name` | `Argument must not be empty.` |
| `marketplace/autoupdate.ts:38-47` | `autoupdate`, `noautoupdate` | `name` (optional) | `Marketplace name` | `Argument must not be empty.` |
| `marketplace/list.ts:25-34` | `list`/`ls` | none (`[]`) | — | n/a (`list ""` → `Too many arguments.`) |
| `plugin/shared.ts:146-160` `parseRequiredPluginMarketplaceRef` | `uninstall` (`uninstall.ts:45`), `enable`, `disable` (`enable-disable.ts:47`) | `ref` (required) | `Plugin name` | `Missing required argument.` |

**Plugin verbs that do NOT share the parser** (each has its own loop over `parseArgs` output) [VERIFIED: Read of each handler + probe]:

| Verb | Parser | Today on `""` | Usage placeholder |
|------|--------|---------------|-------------------|
| `install` | `parseMapModelArgs` + `splitPluginMarketplaceRef` (`install.ts:61-87`) | `Invalid <plugin>@<marketplace> ref: "".` | `<plugin>@<marketplace>` |
| `info` | `withParsedArgs` + own loop (`info.ts:33-68`) | `Invalid <plugin>@<marketplace> ref: "".` | `<plugin>@<marketplace>` |
| `update` | `parseMapModelArgs` + own target logic (`update.ts:147-179`) | `Invalid <plugin>@<marketplace> ref: "".` | `[<plugin>@<marketplace> \| @<marketplace>]` |
| `fetch` | `parseFetchTarget` (`fetch.ts:239-306`) | `Invalid <plugin>@<marketplace> ref: "".` | `[<plugin>@<marketplace> \| @<marketplace>]` |
| `reinstall` | `parseArgs` + `parseTarget` (`reinstall.ts:358-421`) | `Invalid <plugin>@<marketplace> ref: "".` (pinned by `tests/edge/handlers/plugin/reinstall.test.ts:898-920`) | `[<plugin>@<marketplace> \| @<marketplace>]` |
| `list` | `withParsedArgs` + own loop (`list.ts:118-157`) | **accepted**: `list ""` returns an empty info cascade, because it filters to a marketplace named `""` (`list-flow.ts:656,684`) | `[<marketplace>]` |
| `prune`, `pending`, `import`, `bootstrap`, `browse` | no positional | n/a | — |

**Verb that does not reject an empty argument at all:** plugin `list ""`. It is outside the parser that D-05 changes. See Open Question 1.

### Anti-Patterns to Avoid

- **Re-deriving the expected text in a test.** `router.test.ts` must keep a literal `EXPECTED_MARKETPLACE_USAGE` (`router.test.ts:287-295`). The new `marketplaceUsage` cases need literal expected lines. A test that calls the builder to compute its own expectation cannot fail.
- **An `alias` lookup through `Array.find`.** It returns `T | undefined`, which forces an unreachable branch that 100% coverage cannot reach (no `!` or `as` is allowed in `extensions/`). Use the `Record<MarketplaceVerb, …>` lookup.
- **Moving the "Missing required argument." text into `parseCommandArgs` "while you're there".** D-05 does not ask for it, and it changes the callback contract that `tests/edge/args-schema.test.ts:142-212` pins.

## Exact texts (verbatim; use in tests and scenarios)

**Today's `MARKETPLACE_USAGE`** [VERIFIED: extensions/pi-claude-marketplace/edge/router.ts:129-137]:

```text
Usage: /claude:plugin marketplace <add|remove|rm|list|ls|info|update|autoupdate|noautoupdate> ...
  add <source> [--scope user|project]
  remove <name> [--scope user|project]   (alias: rm)
  list [--scope user|project]            (alias: ls)
  info <name> [--scope user|project]
  update [<name>] [--scope user|project]
  autoupdate [<name>] [--scope user|project]
  noautoupdate [<name>] [--scope user|project]
```

**After D-01** (computed with the column rule, then printed by the scratch sketch):

```text
Usage: /claude:plugin marketplace <add|remove|rm|list|ls|info|update|autoupdate|noautoupdate> ...
  add <source> [--scope user|project] [--local]
  remove <name> [--scope user|project] [--local]   (alias: rm)
  list [--scope user|project]                      (alias: ls)
  info <name> [--scope user|project]
  update [<name>] [--scope user|project]
  autoupdate [<name>] [--scope user|project] [--local]
  noautoupdate [<name>] [--scope user|project] [--local]
```

The `list` line gains 10 spaces (12 → 22) so `(alias: ls)` stays under `(alias: rm)`. Besides the four `[--local]` additions, this is the only byte change. D-02 says "keeps its current layout, including the alias notes and column alignment, except for the D-01 change". This whitespace is part of the D-01 change: you cannot add `[--local]` and keep the alignment otherwise. If the user wanted the `list` line kept byte-identical, the alias notes would become misaligned. See Assumption A1.

The scenario cell (Gherkin escapes `|` as `\|` and a newline as `\n`, as `help.feature:12` does today):

```text
Usage: /claude:plugin marketplace <add\|remove\|rm\|list\|ls\|info\|update\|autoupdate\|noautoupdate> ...\n  add <source> [--scope user\|project] [--local]\n  remove <name> [--scope user\|project] [--local]   (alias: rm)\n  list [--scope user\|project]                      (alias: ls)\n  info <name> [--scope user\|project]\n  update [<name>] [--scope user\|project]\n  autoupdate [<name>] [--scope user\|project] [--local]\n  noautoupdate [<name>] [--scope user\|project] [--local]
```

**Per-verb `Usage:` lines, unchanged by D-01/D-02** [VERIFIED: add.ts:26, remove.ts:23-24, list.ts:21, info.ts:16, update.ts:33, autoupdate.ts:23-27]:

```text
Usage: /claude:plugin marketplace add <source> [--scope user|project] [--local]
Usage: /claude:plugin marketplace <remove|rm> <name> [--scope user|project] [--local]
Usage: /claude:plugin marketplace <list|ls> [--scope user|project]
Usage: /claude:plugin marketplace info <name> [--scope user|project]
Usage: /claude:plugin marketplace update [<name>] [--scope user|project]
Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user|project] [--local]
Usage: /claude:plugin marketplace noautoupdate [<name>] [--scope user|project] [--local]
```

Router messages [VERIFIED: router.ts:238, 246, 284, 293]: `"Usage: /claude:plugin marketplace help"`, `"marketplace requires a subcommand."`, `"marketplace help takes no arguments."`, `` `Unknown marketplace subcommand: "${head}".` ``.
`--scope` messages [VERIFIED: args.ts:51,53]: `` `--scope requires a value: "user" or "project".` `` and `` `Invalid --scope value: "${val}". Must be "user" or "project".` ``.
Parser messages [VERIFIED: args-schema.ts:84, 89, 106]: `` `Unknown flag: "${unknownFlag}".` ``, `"Too many arguments."`, `"Argument must not be empty."`. Handler mapping [VERIFIED: marketplace/shared.ts:64,126; plugin/shared.ts:157]: `"Missing required argument."`.

## Scenario inventory (D-03/D-04): today's observed payloads

Observed against a real headless Pi at `124f2311` (119 commands, scratch sandbox). Every row below is a `usage-error`, severity `error`, needs reload `false`, with the verb's own usage line from the table above. **Bold** rows change under D-05.

| Kind | Command args after `marketplace` | Message today |
|------|--------------------------------|---------------|
| Missing (USE-03) | `add` / `remove` / `rm` / `info` | `Missing required argument.` |
| Surplus (USE-04) | `add a b`, `remove a b`, `list a`, `info a b`, `update a b`, `autoupdate a b`, `noautoupdate a b` (also `rm a b`, `ls a`) | `Too many arguments.` |
| Unknown flag (USE-05) | `add a --bogus`, `remove a --bogus`, `list --bogus`, `info a --bogus`, `update --bogus`, `autoupdate --bogus`, `noautoupdate --bogus` | `Unknown flag: "--bogus".` |
| Unknown `--local` (USE-05) | `list --local`, `info a --local`, `update --local` (also `update a --local`) | `Unknown flag: "--local".` |
| Bad scope (USE-06) | `<verb> [a] --scope bad` for all seven, and `--scope bad a` for `add`, `remove`, `info`, `update`, `autoupdate`, `noautoupdate` | `Invalid --scope value: "bad". Must be "user" or "project".` |
| Missing scope (USE-06) | `<verb> [a] --scope` at the end, for all seven | `--scope requires a value: "user" or "project".` |
| Scope swallows positional | `add --scope a`, `update --scope a`, `autoupdate --scope a` (all paths) | `Invalid --scope value: "a". Must be "user" or "project".` |
| `--scope --local` (discretion) | `add --scope --local`, `add --scope --local a`, `list --scope --local`, `update --scope --local` | `Invalid --scope value: "--local". Must be "user" or "project".` |
| **Empty (USE-07)** | **`add ""`, `add ''`, `add "  "`** | **`Missing required argument.`** → `Source must not be empty.` |
| **Empty** | **`remove ""`, `rm ""`, `info ""`** | **`Missing required argument.`** → `Marketplace name must not be empty.` |
| **Empty** | **`update ""`, `autoupdate ""`, `noautoupdate ""`** | **`Argument must not be empty.`** → `Marketplace name must not be empty.` |
| Router (USE-02) | (none) / `bogus` | `marketplace requires a subcommand.` / `Unknown marketplace subcommand: "bogus".`, usage = whole help block |
| USE-08 | `help extra` | `marketplace help takes no arguments.`, usage `Usage: /claude:plugin marketplace help` |
| Discretion | `/claude:plugin help marketplace extra` | `Unknown help topic: "marketplace extra".`, usage `Usage: /claude:plugin help [marketplace]` |

Plugin verbs (D-05 scope), observed: `uninstall ""`, `enable ""`, `disable ""`, `uninstall "  "` report `Missing required argument.` → `Plugin name must not be empty.`. `uninstall` and `enable` with no argument keep `Missing required argument.`.

Edge observations outside the requirements (record them, do not fix): `autoupdate --local --local` is accepted (duplicate flag), and so is `list --scope user --scope project` (the last one wins). A short option is a positional: `add -x` tries the source `-x`, `info -x` reports not added, and `list -x` reports `Too many arguments.`.

### Existing steps cover everything

`When the user runs {string}` plus `Then the result has these fields:` compares the whole envelope. Every field except `schemaVersion`, `origin`, and row arrays must be stated (`command.steps.ts:39, 92-99, 124-129`, `field-rows.ts:78-83`). No new step, world member, or library module is needed.

**Quoting an empty argument in an Outline:** a cell like `update ""` substituted into `"/claude:plugin marketplace <arguments>"` would end the `{string}` early. I verified that both of these forms pass through cucumber and Pi as an explicit empty token, in a scratch feature run with `npx cucumber-js <scratch>.feature --parallel 1` (4 scenarios passed):
- a cell `update ''` (single-quoted empty, inside the double-quoted step). The tokenizer treats `''` like `""` (`args.ts:84-86`).
- a cell `add \"\"`. Gherkin keeps `\"`, and cucumber's `{string}` unescapes it to `"`.

Recommend the `''` form for readability. The `\"\"` form matches USE-07's `update ""` spelling if the user prefers it.

### Where scenarios live

- `features/marketplace/help.feature` (`Feature: Marketplace help`): keep both existing scenarios and update the usage cell in the first (D-01). Add `help marketplace` (USE-01) as its own scenario: an Outline needs 3+ rows, and only two spellings exist. Add the two USE-02 scenarios (bare / unknown subcommand). Their payload is the help block, so they belong with help.
- New `features/marketplace/usage-errors.feature` with `Feature: Marketplace usage errors` (the title must kebab to `marketplace-usage-errors`, which `scripts/check-features.mjs:312-326` enforces). It needs a 2-3 line description. Use one Outline per D-03 kind:
  1. Missing required argument: 3 rows (`add`, `remove`, `info`).
  2. Surplus arguments: 7 rows.
  3. Unknown flag: 10 rows (7 `--bogus` + `list --local`, `info a --local`, `update --local`). Message is a column.
  4. Bad `--scope` value: one row per verb plus the D-04 before/after rows. Proposed 10 rows: `add --scope bad a`, `add a --scope bad`, `remove a --scope bad`, `info a --scope bad`, `list --scope bad`, `update --scope bad a`, `update a --scope bad`, `autoupdate --scope bad a`, `autoupdate a --scope bad`, `noautoupdate --scope bad`. Optionally add `add --scope --local a` (discretion item).
  5. Missing `--scope` value: 7 rows, each with `--scope` last (`add a --scope`, `remove a --scope`, `info a --scope`, `list --scope`, `update a --scope`, `autoupdate a --scope`, `noautoupdate --scope`). A "before the positional with no value" form cannot exist, because the positional becomes the value. A row such as `update --scope a` → `Invalid --scope value: "a"` can show that, if wanted.
  6. Empty argument (D-05): 6 rows, message is a column. RED until D-05 lands.
- Aliases (discretion): recommend **no** `rm`/`ls` rows. The router sends both to the same handler (`router.ts:254-259`), which prints the same `<remove|rm>` / `<list|ls>` usage line. RM-07/LS-04 already pin the alias success. If wanted, one `rm` row in the surplus Outline is enough.
- `help marketplace extra` (discretion): it is the plugin `help` handler (`help.ts:12,184-187`). A scenario for it belongs in `features/plugin/help.feature` (`Feature: Plugin help`), together with the top-level `help` / `help help` scenarios that CONTEXT's USE-01 note mentions. Pinning `TOP_LEVEL_USAGE` whole now means the deferred top-level help fix must edit that scenario later. That is acceptable, but tell the user.

Since every row runs in a fresh sandbox and needs no `Given`, about 45 rows add roughly 5 s to the cucumber run (2 scenarios currently take 2.5 s, measured).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Comparing the payload | A new "the usage error is" step | `the result has these fields:` | It already compares every stated field and fails on unstated ones. |
| Running a command | A new driver | `the user runs {string}` | It already expands tokens and validates the payload schema. |
| Per-verb help consistency test | A test that splits `MARKETPLACE_USAGE` and compares it to `marketplaceUsage()` | The single table (D-02) plus the existing `flag-catalog-drift.test.ts` (d) pins | One definition cannot drift. A cross-check test re-derives its own expectation. |

## Runtime State Inventory

Not a rename/migration phase. No stored data, live service config, OS registration, secret, or build artifact carries these strings. The usage strings exist only in source, tests, and features. None — verified by grep across `extensions/`, `tests/`, `features/`, `docs/`, `README*.md`.

## Common Pitfalls

### Pitfall 1: the drift test pins `--local` as omitted
**What goes wrong:** D-01 adds `[--local]` and `tests/architecture/flag-catalog-drift.test.ts` fails four cases. The message reads `TOP_LEVEL_USAGE's "marketplace add" line documents --local, which this pin calls omitted`.
**Why:** `TOP_LEVEL_USAGE_FLAGS` rows `"marketplace add" | "marketplace remove" | "marketplace autoupdate" | "marketplace noautoupdate": { documented: [], omitted: ["--local"] }` (`flag-catalog-drift.test.ts:257-263`), read through `usageLineFor` from `MARKETPLACE_USAGE` (`:274-284`).
**How to avoid:** Flip those four rows to `{ documented: ["--local"], omitted: [] }` in the D-01 commit. This test is in `test:unpaired`, so the commit hook runs it on every build-input commit. Flipping the pins first gives a clean unit-level RED (4 failures). The wording of that test's assertion messages names `TOP_LEVEL_USAGE` even for marketplace lines (`:304,311`). That is a pre-existing wording quirk; leave it unless you are editing that block anyway.

### Pitfall 2: the commit hook does not catch a missed handler test
**What goes wrong:** You stage `args-schema.ts` + its test. The hook runs only that pair's direct coverage, and `update.test.ts` / `autoupdate.test.ts` / `add.test.ts` still expect the old messages. The hook passes and `npm run check` fails.
**How to avoid:** With `label` required, a missing label fails typecheck in `check:static` across the whole tree. That catches the sources, not the stale test expectations. Run `node --test` on every test file in the D-05 change list before you commit, and run `npm run check` at the plan gate.

**D-05 test expectations that change** [VERIFIED: grep + Read]:
- `tests/edge/args-schema.test.ts`: every schema literal needs `label` (27 references, and `satisfies readonly PositionalSpec[]` will fail without it). The cases that change: `:121-140` (optional `"   "` → `<label> must not be empty.`), `:165-185` (required `"   "`, now the label message instead of the usage), `:315-335` (`""`/`''` optional). The rows `:187-212` (`""` and `"   "` as the **whole args string**, which means no token) stay on the usage/missing path. Check this: `parseArgs("   ")` tokenizes to `[]`, so the value is `undefined`.
- `tests/edge/handlers/marketplace/add.test.ts:531-532` (`'""'` → `Source must not be empty.`). Row `:527-528` (`""`, which is omitted) stays.
- `tests/edge/handlers/marketplace/info.test.ts:324-325`, `remove.test.ts:396-397` → `Marketplace name must not be empty.`.
- `tests/edge/handlers/marketplace/update.test.ts:490` and `:618-619`, `autoupdate.test.ts:447-448` and `:497-498` → `Marketplace name must not be empty.`.
- `tests/edge/handlers/marketplace/shared.test.ts`: has only omitted-argument rows (`:122,334,405,417`). These stay. Add `""` rows for `openMarketplaceCommand` (with the new label opt) and `makeSingleNameMarketplaceHandler` so the paired coverage proves the label is passed.
- `tests/edge/handlers/plugin/shared.test.ts`, `uninstall.test.ts`, `enable-disable.test.ts`: no explicit-empty rows today (their `Missing required argument.` rows at `:355`, `:668,892`, `:387,783,837` are all `args: ""` = omitted, so they stay). Add a `""` row → `Plugin name must not be empty.` at least in `plugin/shared.test.ts`.
- `tests/edge/handlers/plugin/reinstall.test.ts:898-920`: changes **only** if D-05 is extended to non-parser verbs (Open Question 1).

### Pitfall 3: precedence differs by parser path
**What goes wrong:** A scenario that combines two faults expects the same message on every verb.
**Why:** On paths A/D (`add`, `remove`, `autoupdate`, `noautoupdate`), `extractLocalFlag` rejects an unknown long flag **before** `parseArgs` checks `--scope` (`handlers/shared.ts:183-211`). On paths B/C (`info`, `list`, `update`), `parseArgs` runs first. Observed: `add --scope bad --bogus` → `Unknown flag: "--bogus".`, but `list --scope bad --bogus` → `Invalid --scope value: "bad"...`. Inside `parseCommandArgs`, the order is scope → unknown flag → surplus → missing/empty (`args-schema.ts:77-112`). So `update a b --bogus` → `Unknown flag`, and `update "" extra` → `Too many arguments.`.
**How to avoid:** Give each row exactly one fault. D-03 does not ask for combined-fault rows. If one is added, it pins this asymmetry, and the user should know that.

### Pitfall 4: CONTEXT's catalog expectation
**What goes wrong:** A planner writes a task to edit `docs/output-catalog.md` and bump `EXPECTED_UTF8_BYTES` (`tests/architecture/catalog-uat/catalog-contract.test.ts:22`, `46_623`), and finds nothing to edit.
**Why:** The catalog's only usage section is the generic `## Usage errors` block (`docs/output-catalog.md:4534-4548`). Its sample has no marketplace text. No fixture under `tests/architecture/catalog-uat/fixtures/` holds a usage string. `docs/json-output.md:394-419` documents the `usage-error`/`usage-info` fields generically. Neither D-01 nor D-05 changes any catalog byte. [VERIFIED: grep of docs/ and tests/architecture/catalog-uat/]
**How to avoid:** Drop the catalog task, and tell the user that D-05's "costly" reversibility applies to scenarios and unit tests only. Adding a catalog entry for usage errors would be new scope.

### Pitfall 5: phase-scoped green runs
The RED evidence must come from today's code. Phase 7 asserted `git diff --quiet <sha> -- <files>` before the RED run (`07-01-PLAN.md:204`). Do the same, with base `124f2311` or the plan's start commit.

## Code Examples

### D-01 RED (cucumber) — copy Phase 7's evidence shape

```bash
# 1. Edit only features/marketplace/help.feature's usage cell to the D-01 text.
# 2. Run on unchanged production code:
npm run --silent test:cucumber -- features/marketplace/help.feature --parallel 1 \
  --name '^Marketplace help shows the marketplace usage$' \
  --format summary --format junit:<scratch>/08-01-red.xml
# expect exit 1, one failure, diff on the `usage` row only
```

Write `08-01-RED.json` with the fields of `07-01-RED.json`/`06-01-RED.json`: `command`, `exitCode`, `output` (the junit XML text), `targetTest`, `targetFile`, `expected`, `actual`, `semanticAssessment`, `nodeVersion`, `baseCommit`, and `diff`.

Unit RED for D-01: `node --test tests/architecture/flag-catalog-drift.test.ts` after flipping the four pins (expect 4 failures), and `node --test tests/edge/router.test.ts` after updating `EXPECTED_MARKETPLACE_USAGE` (expect the USE-02 cases at `:691,732,752,758` to fail).

### D-05 RED

```bash
npm run --silent test:cucumber -- features/marketplace/usage-errors.feature --parallel 1 \
  --name '^<empty-argument Outline title>$' --format summary --format junit:<scratch>/08-0N-red.xml
# expect 6 failures (one per row), each diff only on `message`
node --test tests/edge/args-schema.test.ts   # after rewriting its expectations to the label messages
```

`--name` matches all rows of an Outline (Phase 7's RED showed `tests="3"` for one title).

### Run one feature / one scenario / one pair quickly

```bash
npm run --silent test:cucumber -- features/marketplace/help.feature --parallel 1   # ~4 s wall
npx cucumber-js --name '<scenario title>'
node --test tests/edge/router.test.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/router.ts
npm run check:features   # dry-run + layout/wording rules, no Pi
```

## State of the Art

| Old | New | Impact |
|-----|-----|--------|
| Help line and `Usage:` line typed separately (`router.ts:129-137` vs each handler's `USAGE`) | One `MARKETPLACE_VERB_SIGNATURES` row per verb (D-02) | A new flag reaches both surfaces at once. |
| Empty required → usage (mapped to `Missing required argument.`); empty optional → `Argument must not be empty.` | `<Label> must not be empty.` for both. An omitted argument stays `Missing required argument.` (D-05) | Changes the `usage-error` `message` for explicit empties only. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `list` line's extra 10 spaces count as part of D-01 (alignment kept), rather than a violation of "byte-for-byte except `[--local]`" | Exact texts | If the user wants the `list` line kept byte-identical, the help scenario and router test literal change to a misaligned form, and the column rule changes to "fixed 3 spaces after each alias line". |
| A2 | D-05's "plugin verbs that take `<plugin>@<marketplace>`" means the parser-sharing ones (`uninstall`, `enable`, `disable`), per "every verb that shares the parser" | Pattern 2 | If it means every plugin verb, five more handlers (`install`, `info`, `update`, `fetch`, `reinstall`) need their own empty checks and labels, and `reinstall.test.ts:898-920` changes. |
| A3 | `''` cells (instead of `""`) are an acceptable spelling of USE-07's `update ""` in scenarios | Scenario inventory | Low. `\"\"` cells work too (verified). |
| A4 | ESLint accepts the D-02 sketch as written (not linted this session; typecheck and fallow were run) | Pattern 1 | Low. Prettier/ESLint may reflow lines or ask for small changes. |

## Open Questions

1. **D-05 reach into plugin verbs outside `parseCommandArgs`.**
   - What we know: `install`, `info`, `update`, `fetch`, `reinstall` reject `""` as `Invalid <plugin>@<marketplace> ref: "".`. Plugin `list ""` is accepted and lists nothing. None of them shares the parser.
   - What's unclear: CONTEXT says D-05 covers "every verb that shares the parser", and its example of a label taken from a placeholder (the `@<marketplace>` form) only exists on the non-sharing verbs.
   - Recommendation: Ask the user. The default (A2) is parser-sharing verbs only. Record `install`/`info`/`update`/`fetch`/`reinstall` and plugin `list ""` as follow-ups. If they are extended, the labels would be `Plugin name` for `install`/`info` (placeholder `<plugin>@<marketplace>`), and for `update`/`fetch`/`reinstall` a label that covers the `@<marketplace>` form too. The placeholder is `[<plugin>@<marketplace> | @<marketplace>]`, so `Plugin name` reads wrong for `@`. The user must choose.
2. **Pin `help` / `help help` (TOP_LEVEL_USAGE) now?** CONTEXT lists them under USE-01, but they are plugin help, and the deferred top-level fix will change that text. Recommendation: pin them in `features/plugin/help.feature`, and say so to the user. Or leave them out, since USE-01's requirement text names only the two marketplace spellings.
3. **CHANGELOG.** D-01 and D-05 change user-visible text. Phase 7 added branch CHANGELOG bullets (`07-03-PLAN.md:15,44`). Recommend one bullet via the `changelog` skill: the marketplace help now lists `--local`, and an empty argument names its field.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v26.11.1 (engines `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`) | — |
| Pi peer (`@earendil-works/pi-coding-agent`, dev dep) | cucumber headless Pi | ✓ | ran 119 commands and the 2 help scenarios | — |
| `@cucumber/cucumber` | scenarios | ✓ | 13.3.0 | — |
| `fallow` | gate | ✓ | 3.31.0 | — |

No network is needed. Every scenario runs on an empty sandbox.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit) + `@cucumber/cucumber` 13.3.0 (behavioral, real headless Pi) |
| Config file | `cucumber.json` (tags `not @url and not @github`, parallel 8); none for node:test |
| Quick run command | `npm run --silent test:cucumber -- features/marketplace/<file>.feature --parallel 1` / `node --test <test-path>` |
| Full suite command | `npm run check` |

### Phase Requirements / Decisions → Test Map
| ID | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| USE-01 | `marketplace help` → usage-info with the D-01 help | cucumber | `npm run --silent test:cucumber -- features/marketplace/help.feature --parallel 1` | ✅ (update cell) |
| USE-01 | `help marketplace` → same payload | cucumber | same | ❌ new scenario in help.feature |
| USE-01 (CONTEXT note) | `help`, `help help` → TOP_LEVEL_USAGE | cucumber | `... features/plugin/help.feature` | ❌ optional (Open Q 2) |
| USE-02 | bare `marketplace`, `marketplace bogus` → reason + whole help | cucumber + unit (`tests/edge/router.test.ts:691,732,752,758`) | help.feature run; `node --test tests/edge/router.test.ts` | ❌ scenarios / ✅ unit |
| USE-03 | `add`/`remove`/`info` with nothing → `Missing required argument.` | cucumber Outline | `... features/marketplace/usage-errors.feature --parallel 1` | ❌ new file |
| USE-04 | surplus, 7 verbs | cucumber Outline | same | ❌ |
| USE-05 | unknown flag + `--local` on list/info/update | cucumber Outline | same | ❌ |
| USE-06 | bad/missing `--scope`, every verb + D-04 positions | 2 cucumber Outlines | same | ❌ |
| USE-07 / D-05 | empty argument → `<Label> must not be empty.` | cucumber Outline (RED first) + unit `tests/edge/args-schema.test.ts`, handler tests | same; `node --test tests/edge/args-schema.test.ts tests/edge/handlers/marketplace/*.test.ts tests/edge/handlers/plugin/shared.test.ts` | ❌ Outline / ✅ unit (rewrite) |
| USE-08 | `marketplace help extra` rejected | cucumber | help.feature run | ✅ unchanged |
| D-01 | help shows `[--local]` on 4 lines | cucumber (RED first) + `tests/architecture/flag-catalog-drift.test.ts` pins + `tests/edge/router.test.ts` literal | `node --test tests/architecture/flag-catalog-drift.test.ts tests/edge/router.test.ts` | ✅ (edit) |
| D-02 | one signature builds both surfaces | unit `tests/edge/router.test.ts`: `marketplaceUsage` per verb vs literal lines (covers alias and no-alias arms); existing handler tests keep their literal `USAGE` expectations as independent oracles | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/router.ts` | ❌ new cases |

### Sampling Rate
- **Per task commit:** the owner `node --test` files + the touched feature file with `--parallel 1`. The hook runs `check:commit`, which does not run cucumber.
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `features/marketplace/usage-errors.feature`: new file (USE-03..07)
- [ ] new scenarios in `features/marketplace/help.feature` (USE-01 `help marketplace`, USE-02 ×2)
- [ ] `tests/edge/router.test.ts`: `marketplaceUsage` cases (D-02)
- No framework install, fixture, or step module needed.

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is treated as enabled.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | `parseArgs` (closed `--scope` set) + `parseCommandArgs` (unknown flag, arity, empty value). D-05 tightens the empty-value message only. |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| Reflected user input in error text | Tampering / Info disclosure | Echoed values (`"<flag>"`, `"<x>"`) go into a structured `message` field, rendered by the dispatch module. The labels are fixed literals, so D-05 echoes no user input. Nothing new is introduced. |
| An empty name reaching an orchestrator (path built from `""`) | Tampering | Already rejected at the edge for the parser verbs. D-05 keeps the rejection. Plugin `list ""` reaches the orchestrator but only filters (read-only, no path use). |

## Sources

### Primary (HIGH confidence)
- Read this session: `edge/router.ts`, `edge/args.ts`, `edge/args-schema.ts`, `edge/handlers/shared.ts`, `edge/handlers/marketplace/{add,remove,list,info,update,autoupdate,shared}.ts`, `edge/handlers/plugin/{shared,install,update,fetch,reinstall,info,list,help,enable-disable,uninstall}.ts`, `edge/flag-catalog.ts`, `tests/architecture/flag-catalog-drift.test.ts`, `tests/edge/args-schema.test.ts`, `features/marketplace/help.feature`, `features/step_definitions/command.steps.ts`, `features/lib/{pi-commands,pi-process,field-rows}.ts`, `scripts/check-features.mjs`, `.fallowrc.json`, `.agents/skills/{cucumber,typescript-unit-tests,local-verification}/**`.
- Live probe: 119 `/claude:plugin` commands against a real headless Pi (scratch sandbox, `features/lib/pi-process.ts` driver) at `124f2311`.
- Scratch-copy experiments: D-02 sketch with `tsc --noEmit` (exit 0), `fallow dead-code` (private type leak measured, then fixed), `fallow health` (pass); a scratch feature run proving the `''` and `\"\"` cell forms.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new dependency; versions read from the tools.
- Architecture: HIGH. The D-02 shape was typechecked and passed fallow; the import graph was read.
- Pitfalls: HIGH. Each one was observed (probe, drift-test read, catalog grep).

**Research date:** 2026-10-20
**Valid until:** 2026-11-19 (stable; recheck if `edge/` changes on `main` before planning)
