# Phase 1: Suite Foundation - Research

**Researched:** 2026-10-15
**Domain:** cucumber-js 13 behavioral-test infrastructure (payload driver, token projection, kind-neutral steps, usage + Gherkin/layout gate, ESLint blocks) over a real headless Pi in RPC mode
**Confidence:** HIGH. Every payload shape, emission order, gate mechanic, and ESLint selector below was measured on this branch (Node 26.11.1, with spot checks on Node 22.22.2). Throwaway probes lived in the session scratchpad and were not committed.

## Summary

The current suite (13 scenarios, 9 step definitions, 5.6 s wall) already has the right lifetime model; Phase 1 widens three seams and adds two gates. The driver must return every `claude-plugin` entry, validate each against `NOTIFICATION_PAYLOAD_SCHEMA`, and let steps assert count and kind. Measurements show **two** multi-payload marketplace commands, not one: a bare `update` (one `cascade` per marketplace, project scope first, then **insertion order** within a scope, not name order), and `info <name>` without `--scope` when a scope's manifest is broken (a `marketplace-info` plus a `plugin-info`, or two `plugin-info`, healthy block first). No `mcp-config-notices` payload, extension error, dialog, or non-`claude-plugin` entry appeared in any measured command in a clean sandbox.

The usage gate is easiest as a Node script over the `@cucumber/cucumber/api` (`loadConfiguration` then `runCucumber` with `dryRun: true`, `tagExpression: ""`, `parallel: 0`). The message stream gives `stepDefinition`, `testCase.testSteps[].stepDefinitionIds` (length 0 = undefined, more than 1 = ambiguous), and `gherkinDocument` ASTs. So one script (`scripts/check-features.mjs`) can run the usage gate and the Gherkin/layout gate without importing the transitive `@cucumber/gherkin` package. **`runCucumber(...).success` is `true` in dry run even with undefined and ambiguous steps** (measured), so the script must compute its own verdict. The dry run takes about 0.75 s, starts no Pi, and fits `check:static` (12.6 s today).

Three findings change what the seed scenarios may assert. (1) A **path-source `marketplace update` never reports `updated`** while autoupdate is off: `update.ts:387` reads the pre-refresh key from the live file the user already rewrote, so it always reports `skipped {up-to-date}`. UPD-02's dir/file rows will fail against current code; this is a Phase 6 issue, so do not seed it. (2) `add`'s cascade block carries `status: "added"` and **no `details`**, so the CONTEXT example that puts `{scenario time}` in an add result is wrong; `lastUpdatedAt` appears only in `list` blocks and `info` payloads. (3) An empty result (`list`, bare `update`, bare `autoupdate` with nothing added) is one `cascade` with `marketplaces: []`, and a header-only table cannot express it through the current `namesLike` projection. A `lists no marketplaces` step is cross-verb (LS-01, UPD-08, AU-07).

**Primary recommendation:** Widen `features/lib/pi-commands.ts` with `runCommandPayloads`, and keep `runCommand` as the strict single-cascade wrapper for `Given`s. Move `flatten`/`cell`/`namesLike` into a `features/lib/` module that projects tokens at each leaf. Record each published marketplace's kind on the world, so later steps dispatch on it. Write `scripts/check-features.mjs` over the cucumber API, wire it as an npm script in `check:static`, and add two ESLint blocks. Seed one real scenario per new shared step in the verb feature files.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Payload-kind assertions
- **D-01:** Every result is stated with a `kind` row: `kind` is removed from the hidden fields of `the result has these fields:`, so a table reads `| kind | marketplace-info |`. The 13 existing plugin scenarios gain `| kind | cascade |`. Wire kind literals are written as-is (hyphenated).
- **D-02:** A command that emits several payloads (a bare `update`: one cascade per marketplace, project scope first) is compared in two whole-value steps: an envelope table with one row per payload in emission order (kind, severity, needs reload, summary), which pins count, order, and kinds; then a rows step listing the marketplace rows (and plugin rows, when present) across every payload in order. Single-payload steps keep asserting exactly one payload (never filter for "the" result).

#### Run-specific tokens
- **D-03:** Tokens use braces: `{home}` now, `{git host}` in Phase 9, and one per sandbox root that can appear in output. Not `<...>` (Outline placeholders, and the usage text prints `<source>`/`<name>`), not `~` (the product prints `~` legitimately, ADD-14), not `$HOME`. Commands expand tokens to real values; result cells are projected back by exact substring only. Examples cells may carry tokens: `| dir | {home}/marketplaces/tools |`, with the row's source reaching steps through an ordinary `<source>` Examples column.
- **D-04:** Dir and file fixtures live under the sandbox HOME (`{home}/marketplaces/<name>`), and commands type the absolute path through `{home}`. The `~/...` form is exercised only by ADD-14's own scenario. The `file` kind is `<root>/.claude-plugin/marketplace.json` (research C-10 note); a manifest outside `.claude-plugin/` belongs to Phase 6's C-10 scenario.
- **D-05:** A `last updated at` cell reads `{scenario time}`: any valid ISO timestamp between the scenario's start and the check projects to it; anything else (stale, epoch, future, malformed) stays literal and fails.

#### Shared steps and the unused gate
- **D-06:** Phase 1 defines every step two or more verb phases need (inventory derived from the requirements), and gives each its first use in a real scenario in the verb feature file it belongs to (e.g., ADD-01's multi-kind Outline in `features/marketplace/add.feature`, a bare-update scenario in `update.feature`). The verb phase then owns and extends that file and completes its requirements. No throwaway smoke feature, no allowlist; the gate is strict from Phase 1.
- **D-07:** Config steps only read: they compare a scope's `claude-plugins.json` and `claude-plugins.local.json` declarations. No config-write `Given` until a requirement needs one. ROADMAP Phase 1 SC3's "read and write" is narrowed to read accordingly.
- **D-08:** A step defined verb-local that a later verb phase also needs is promoted into the shared marketplace step module by the phase that finds the second use, in its own commit. Verb-local step text names its verb so two verbs never write the same text by accident.

#### Usage gate
- **D-09:** The usage gate dry-runs every scenario, ignoring the `not @url and not @github` exclusion: a step only excluded rows use counts as used, and every step in an excluded row must match exactly one definition. CLI `--tags` is and-joined with the profile's tags, so the gate needs its own profile or the cucumber API. (Measured: the dry-run usage report honors tag filters; under `--tags @nonexistent` all 9 current definitions read UNUSED.)
- **D-10:** The gate runs in `check:static`, in the same `scripts/check-features.mjs` as the folded Gherkin/layout gate, so a commit touching a build input fails on an unused, undefined, or ambiguous step within seconds. The dry run starts no Pi.

### Claude's Discretion
- Exact step wording (layout.md: step text belongs to the writer), module split under `step_definitions/marketplace/`, the token set beyond `{home}`, and the window tolerance for `{scenario time}`.
- Renaming `PluginWorld` to `ScenarioWorld` (the skill's examples use `ScenarioWorld`).
- How `Given` setup commands use the driver (strict single cascade or the full payload driver).

### Folded Todos
- **`2026-10-13-cucumber-rules-trial`** (`.planning/todos/pending/`, `resolves_phase: 1`). §1 and §1b are already done (the layout became today's `step_definitions/` + `support/`); §2.4 is DRV-04. Folded:
  - §2.3: `scripts/check-features.mjs` in `check:static`, enforcing the current `features.md`/`layout.md` rules mechanically: file layout and catch-all names, file name = kebab-cased feature title without the function word, one feature per file with a non-empty description, no `And`/`But`, lower-case step text, no `should`, no `Given` after a `When`, `Background` holds `Given` only, scenario titles start upper case. Paths follow the current layout (`step_definitions/**/*.steps.ts`, `support/`, `lib/`), not the todo's older `steps/` paths.
  - §2.1-2.2, updated to the current rules: step modules export nothing and use Cucumber expressions only (no regex step text); `features/lib/**` may not import `Given`, `When`, `Then`, hooks, `setWorldConstructor`, or `defineParameterType`. The todo's named-function and `assert*`-name bullets are dropped: current `steps.md` requires anonymous `function` expressions and has no role-name rule.
  - Per CONVENTIONS.md, no committed negative controls for these gates; check each once by hand against a planted violation.

### Deferred Ideas (OUT OF SCOPE)
- A config-write `Given` — added by the first phase whose requirement needs it (D-07).

#### Reviewed Todos (not folded)
- `2026-10-13-cucumber-rules-trial` §3 (port the skill and gates to `acolomba/blueprint-typescript` draft PR #7): another repository; stays in the todo.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DRV-01 | The driver returns every payload a command emits, validates each against the published notification schema, and asserts the expected kinds and count (`cascade`, `marketplace-info`, `marketplace-info-cascade`, `marketplace-not-added`, `usage-error`, `usage-info`, `plugin-info`; one payload per marketplace from a bare `update`) | Payload inventory (measured, all `V.Check` true); Pattern 1 (driver); Pattern 4 (envelope + rows steps); the `info` multi-payload finding |
| DRV-02 | Run-specific values (sandbox paths, the stand-in origin) are written in scenarios as exact tokens substituted in both directions, and `lastUpdatedAt` is checked within a time window, never hidden | Pattern 2 (tokens): where paths surface, measured unredacted in JSON; realpath pitfall; key-scoped `{scenario time}` window from world construction |
| DRV-04 | A gate fails when a step definition is unused, undefined, or ambiguous (`cucumber-js --dry-run --format usage`) | Pattern 5: the API dry run, measured detection of UNUSED/undefined/ambiguous, tag override, `success` is not a verdict, about 0.75 s, no Pi |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Never commit to `main`; branch is `features/cucumber-behavioral-tests`. Never rebase; never `--no-verify`. Commit per `.agents/skills/committing/SKILL.md`.
- Read before editing; trace callers before modifying a function.
- Every plan `SUMMARY.md` includes `## Threat Flags` (even "None").
- Build verification per `.agents/skills/local-verification/SKILL.md`: the commit hook runs `check:commit` (`check:static` + unpaired + staged pairs; **not** `test:cucumber`). GSD gates (post-merge wave, phase, merge) run `npm run check`, which includes `test:cucumber`.
- `npm run check` must stay green: typecheck, ESLint (`--max-warnings 0`), fallow (dead code, health `maxCognitive: 15` / `maxCyclomatic: 20`, dupes threshold 3, rule pack), Prettier, pairing, tests, cucumber, direct coverage.
- **A gate's run over the real tree is its only committed proof. Do not commit negative controls or planted-violation tests** (CONVENTIONS.md; CONTEXT folded todo).
- Comments cite durable IDs (D-NN, DRV-NN), never `Phase N` / `Plan N` / `Pitfall N`. Default to no comment on trivial code.
- Named exports only; explicit return types on exported functions; `curly: all`; blank line after blocks; import order builtin, external, internal, parent, sibling, index, object, type (type-only last).
- Output discipline (IL-2) applies to `extensions/**` only; `scripts/*.mjs` may use `process.stdout.write` (ESLint `no-console: warn` there, and a warning fails lint).
- Upstream parity: none applies (test infrastructure only).
- Subagent and probe tests must use a hermetic home; never touch the real `~/.pi/agent`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Run a command and collect every payload, schema-validated | `features/lib/pi-commands.ts` (driver) | `features/lib/pi-process.ts` (JSONL exchange, unchanged) | world-and-stand-ins.md: "A driver ... validates what it returns against the published contract" |
| Token expansion (commands) and projection (result leaves, `{scenario time}`) | `features/lib/` (a pure module taking a token map) | world (builds the map from the run's realpath'd sandbox; holds `startedAt`) | lib must not import support (registers hooks); the world reaches the run |
| Kind dispatch (dir/file now, url/github later) for publish, republish, make-invalid | `features/lib/` (fixture dispatcher over `path-marketplace.ts`) | world (records kind and typed source per marketplace name) | Kind phases then edit lib only, never a verb's step module |
| Shared marketplace steps (publish, add, marketplace rows, invalid manifest) | `features/step_definitions/marketplace/<topic>.steps.ts` | — | layout.md: a module that grows becomes `step_definitions/<function>/<topic>.steps.ts` |
| Envelope and multi-payload steps, `the result has these fields:` | `features/step_definitions/command.steps.ts` | — | layout.md: "running a command and reading its result goes in `command.steps.ts`" |
| Config read steps | `features/step_definitions/config.steps.ts` | world getter for config paths | `claude-plugins.json` declares both plugins and marketplaces, so it is its own function |
| New-session `Given` | `features/step_definitions/session.steps.ts` | — | existing session vertical |
| Usage + Gherkin/layout gate | `scripts/check-features.mjs` via an npm script in `check:static` | `@cucumber/cucumber/api` | D-10 |
| Step-module and lib import discipline | `eslint.config.js` (two new `features/` blocks) | — | folded §2.1-2.2 |
| Tag exclusion | `cucumber.json` `default.tags` | cucumber skill `features.md` (SC4 docs) | ROADMAP source-kind strategy |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@cucumber/cucumber` | 13.3.0 (installed; `engines: "node": "22 \|\| 24 \|\| >=26"`) [VERIFIED: node_modules/@cucumber/cucumber/package.json] | Runner, `./api` (`loadConfiguration`, `runCucumber`) for the gate | Already the suite runner |
| `typebox` | 1.3.34 installed (`typebox/compile` export `./build/compile/index.mjs`) [VERIFIED: node_modules/typebox/package.json] | `Compile(NOTIFICATION_PAYLOAD_SCHEMA)`; `Type.Static` for `NotificationPayload` | Already used by `pi-commands.ts` |
| `node:assert/strict` | Node built-in | Whole-value assertions | steps.md |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@cucumber/gherkin` | 42.0.1 (transitive via `@cucumber/cucumber`; not in `package.json`) [VERIFIED: node_modules/@cucumber/cucumber/package.json:227] | Gherkin AST | **Do not import directly.** The same AST arrives as `gherkinDocument` envelopes from `runCucumber`'s `onMessage`. A direct import would be an unlisted dependency. |
| `@cucumber/messages` | 34.2.1 (transitive) | Envelope types | Types only, if at all |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| API dry run with `tagExpression: ""` | A second `cucumber.json` profile without `tags` plus `--format usage-json:<tmp>` | Duplicates the `import` list, leaves a file to parse, and `--tags` on the CLI would AND-merge with any profile tags. The API overrides one field after loading `default`. |
| `onMessage` envelopes | Parsing `--format usage` text | Text parsing is fragile; envelopes give ids and locations directly |
| `@cucumber/gherkin` direct import | `gherkinDocument` envelopes | Envelopes need no new dependency, and fallow and the lockfile stay unchanged |

**Installation:** none. No new packages are installed in this phase.

## Package Legitimacy Audit

Not applicable: this phase installs no external packages. Every library used is already in `package-lock.json`.

## Architecture Patterns

### System Architecture Diagram

```
feature file (Outline row: <source kind>, <source> = "{home}/marketplaces/tools")
   │  cucumber substitutes <placeholders>
   ▼
Given "the marketplace X is published as a <kind> source"
   │  lib fixture dispatcher(kind) ── dir/file ──► writeMarketplace({home}/marketplaces/X)
   │                                └─ url/github ─► throw (lands with the kind's stand-in)
   │  world.published.set(X, {kind, typedSource})
   ▼
When "the user runs \"/claude:plugin marketplace add {home}/... --scope project\""
   │  expandTokens(command, world.tokens)  ({home} -> realpath of sandbox HOME)
   ▼
runCommandPayloads(pi, command) ──JSONL──► Pi child (RPC, --offline) ──► extension
   │  assertQuiet; disposition "handled"; payloads = entries[customType=claude-plugin]
   │  every payload: Compile(NOTIFICATION_PAYLOAD_SCHEMA).Check  else throw
   ▼
world.results: NotificationPayload[]   (emission order)
   │
   ├─► single-payload Then: lastResult() asserts length 1 ──► flatten leaves
   │        └─ projectLeaf(key, value): exact substring {home}; lastUpdatedAt in
   │           [world.startedAt, now] -> "{scenario time}"  ──► deepStrictEqual(table.raw())
   └─► multi-payload Then: envelope rows (one per payload) + rows across payloads

check:static ──► scripts/check-features.mjs
   ├─ fs walk of features/ ─► layout and catch-all checks
   └─ runCucumber(dryRun, tagExpression "", parallel 0, order defined)
        ├─ gherkinDocument ─► Gherkin style checks
        ├─ stepDefinition + testCase.stepDefinitionIds ─► unused / undefined / ambiguous
        └─ parseError / undefinedParameterType ─► fail
```

### Recommended Project Structure
```
features/
├── marketplace/                    # NEW function dir (.feature only), seeded by Phase 1
│   ├── add.feature                 # seeds: ADD-01 Outline (dir, file, @url, @github), ADD-14 or ADD-13, ADD-03
│   ├── list.feature                # seeds: LS-01 (empty), LS-02 ({scenario time})
│   ├── info.feature                # seeds: INFO-01 ({home} projection), INFO-08 (becomes invalid, plugin-info)
│   └── update.feature              # seeds: UPD-07 (bare update, multi-payload)
├── plugin/                         # existing; each `has these fields:` table gains | kind | cascade |
├── step_definitions/
│   ├── command.steps.ts            # run, has these fields (kind stated), lists these plugins, envelope + multi-rows
│   ├── config.steps.ts             # NEW: a scope's claude-plugins(.local).json marketplaces
│   ├── session.steps.ts            # + Given "the user has started a new pi session"
│   └── marketplace/                # SPLIT of marketplace.steps.ts (the flat file must not remain)
│       ├── publishing.steps.ts     # publish as <kind>, offers these plugins (kind-aware), added to scope, becomes invalid
│       └── results.steps.ts        # lists these marketplaces / lists no marketplaces (name is the writer's)
├── support/
│   ├── pi-process.ts               # realpath the run root; marketplaces root under HOME
│   └── world.ts                    # results[], startedAt, tokens, published map, config paths
└── lib/
    ├── pi-commands.ts              # + runCommandPayloads, NotificationPayload
    ├── path-marketplace.ts         # + manifest overrides (invalid, description) as phases need
    ├── <payload-tables>.ts         # NEW: flatten/cell/namesLike + projection (name: the writer's, no catch-all)
    └── <kind dispatcher>.ts        # NEW: kind -> publish/typed source (name the vertical, not "shared")
scripts/check-features.mjs          # NEW gate
```
Verb phases add `features/step_definitions/marketplace/<verb>.steps.ts`. Shared topic modules must not use verb names (`add`, `remove`, `list`, `info`, `update`, `autoupdate`, `help`), so the W1 phases' files stay disjoint.

### Pattern 1: The widened driver (DRV-01)
**What:** `runCommandPayloads(pi, command): Promise<NotificationPayload[]>` asserts a quiet exchange and `disposition: "handled"`. It validates every `claude-plugin` entry with one compiled union validator and returns the entries in emission order. It asserts at least one payload (every measured command emits at least one). `runCommand` stays the strict wrapper: exactly one payload, of kind `cascade`.
**Given strictness (discretion):** keep `Given` setup commands on the strict `runCommand` path (one cascade, severity `info`). No requirement uses a multi-payload command as a `Given`.
```typescript
// Source: features/lib/pi-commands.ts (existing shape) + notification-wire.ts:800
export type NotificationPayload = Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA>;
const PAYLOAD_VALIDATOR = Compile(NOTIFICATION_PAYLOAD_SCHEMA);

export async function runCommandPayloads(pi: PiProcess, command: string): Promise<NotificationPayload[]> {
  const exchange = await pi.request({ type: "prompt", message: command });
  assertQuiet(exchange);
  assert.deepStrictEqual(exchange.response.data, { disposition: "handled" }, command);
  const payloads = exchange.entries
    .filter((entry) => entry.customType === "claude-plugin")
    .map((entry) => entry.data);
  assert.notDeepStrictEqual(payloads, [], command);
  return payloads.map((payload) => {
    assert.ok(PAYLOAD_VALIDATOR.Check(payload), JSON.stringify(PAYLOAD_VALIDATOR.Errors(payload)));
    return payload; // narrowed by Check; no `as`
  });
}
```
Steps narrow by kind with an assertion, never a filter: e.g. `assert.strictEqual(result.kind, "cascade")` before reading `marketplaces`.

### Pattern 2: Tokens, both directions (DRV-02)
- **Values:** `{home}` = the **realpath** of the sandbox HOME. `tests/e2e/_rpc.ts:141-165` realpaths every sandbox location before spawning Pi (`HOME: sandbox.home` at :169), while `PiRun.sandbox` holds the nominal `mkdtemp` path. On Linux `/tmp` is real (verified: `realpath /tmp` = `/tmp`), so the two agree there. On macOS `tmpdir()` sits under a symlink. **Realpath the run root once in `BeforeAll`** and use it for the sandbox, the marketplaces root, and the token map.
- **Where paths surface (measured, JSON is unredacted):** `marketplace-info.source.absPath`; the failed-add block `name` (the typed source, e.g. `{home}/marketplaces/nope` for `source missing` and `invalid manifest`); update cause chains (`ENOENT: no such file or directory, open '{home}/marketplaces/beta/.claude-plugin/marketplace.json'`); `claude-plugins.json` `source`. `redactCauseChain`/`redactAbsolutePaths` (`shared/redact-absolute-paths.ts`) are applied only on specific arms in `notification-present.ts` (e.g. `prune-committed-warning`), not on marketplace-update cascades. The probe output above is the proof.
- **Other roots:** no measured marketplace payload names the agent dir or the project cwd. A typed relative source (`./x`) would resolve under the project, but no requirement types one. Recommend implementing the map generically and populating only `{home}`. Add `{project}`/`{agent dir}` only when a scenario shows them.
- **Expansion:** in `the user runs {string}` and `the user has run {string}` (Outline substitution happens first, so Examples cells with `{home}` are covered). The add `Given` builds its own source from the recorded kind with the real path, so it needs no expansion.
- **Projection:** at each **leaf string** before `cell()` joins arrays (so each `causeChain` element is projected), by exact substring replacement of the realpath with `{home}`. Never use a regex or a prefix pattern.
- **`{scenario time}`:** key-scoped to `lastUpdatedAt` leaves only. Window = `[world.startedAt, Date.now()]` inclusive. Set `startedAt` as a world field initializer; Cucumber constructs the world before the `Before()` hooks, so a stale timestamp from an earlier scenario always falls before it. Validity: `new Date(s).toISOString() === s`. Tolerance: zero; Pi and the worker share the host clock, and Pi stamps with `new Date().toISOString()` (`update.ts:455`, measured ms precision). Anything else stays literal and fails.
- **Never** put a token in step-definition text: `{home}` in a Cucumber expression is an undefined parameter type.

### Pattern 3: Kind recorded on the world, dispatched in lib
- `Given the marketplace {string} is published as a {word} source` (or a `source kind` parameter type in a support module named after it): writes the fixture for that kind and records `{ kind, typedSource }` on the world. dir: `{home}/marketplaces/<name>`. file: `{home}/marketplaces/<name>/.claude-plugin/marketplace.json`.
- `Given the marketplace {string} offers these plugins:` (existing) publishes, or republishes, under the recorded kind (default dir), so plugin features and UPD republish keep working.
- `Given the marketplace {string} is added to the {word} scope` (existing) types the recorded `typedSource`.
- `Given the marketplace {string} manifest becomes invalid` (wording: the writer's) rewrites the manifest as **schema-invalid JSON** (e.g. `plugins: "nope"`). Measured: `info` gives `plugin-info` `reasons: ["invalid manifest"]`, `update` gives cause `marketplace.json schema invalid: /plugins: must be array`, and both are extension-composed. Corrupt JSON instead gives `reasons: ["unparseable"]` on `info` (it does not match INFO-08's wording) and a V8 `SyntaxError` text in the update cause chain.
- url/github arms throw a clear error until their kind phase lands; excluded rows never execute, but their step text must still match exactly one definition (D-09).
- **Rule for later phases:** a verb-local step that needs a kind (e.g. ADD-07's malformed-at-publish) calls the lib dispatcher. A kind phase then edits only lib/support and never a verb's step module.

### Pattern 4: Result steps (single, empty, multi)
- **`the result has these fields:`**: drop `kind` from `UNSTATED_FIELDS` (D-01). Keep `schemaVersion` and `origin` hidden. Hide `marketplaces` and `blocks` (arrays of objects), and project leaves. It already handles `marketplace-not-added` (`name`, `scope`, `reasons`), `marketplace-info` (`source kind`, `source abs path`, `details autoupdate`, `details last updated at`, `description`), `plugin-info` (`marketplace name`, `plugin status`, ... `plugin components resolved`), `usage-error` (`message`, `usage`), and `usage-info`. Multi-line `usage` fits a table cell through the Gherkin escape `\n` (verified: a cell `line one\nline two \| pipe` parses to `"line one\nline two | pipe"`).
- **`the result lists these marketplaces:`** (new, shared): rows are the flattened blocks without `plugins`. It must **fail if any block has plugin rows**, sending the writer to `lists these plugins:`, so no row goes unseen.
- **`the result lists no marketplaces`** (new, shared): asserts kind `cascade` and `marketplaces: []`. A header-only table cannot work, because `namesLike` derives columns from records and zero records yield `[[]]`.
- **Envelope step (D-02):** one row per payload, columns from `namesLike` over every scalar leaf except `marketplaces`/`blocks`. **Measured: bare-update payloads each carry `tally label | tally failures | tally warnings | tally success count`**, so the D-02 column list (kind, severity, needs reload, summary) is a minimum; whole-value comparison makes the table state the tally columns as well. The same step covers the mixed `marketplace-info` + `plugin-info` fan-out (blank cells for absent fields).
- **Rows across payloads (D-02):** flatten `marketplaces` of every cascade payload in order (block fields plus plugin fields, like `pluginRecords`).

### Pattern 5: The usage + Gherkin/layout gate (DRV-04, folded §2.3)
```javascript
// scripts/check-features.mjs (shape; measured working on Node 22.22.2 and 26.11.1)
import { Writable } from "node:stream";
import { loadConfiguration, runCucumber } from "@cucumber/cucumber/api";

const { runConfiguration } = await loadConfiguration({}, { cwd: process.cwd() }); // default profile
runConfiguration.sources.tagExpression = "";        // D-09: ignore "not @url and not @github"
runConfiguration.sources.order = "defined";          // no "Random order using seed" noise
runConfiguration.runtime.dryRun = true;
runConfiguration.runtime.parallel = 0;
const sink = new Writable({ write(_chunk, _encoding, done) { done(); } });
const definitions = new Map(); const used = new Set(); const findings = [];
await runCucumber(runConfiguration, { cwd: process.cwd(), stdout: sink, stderr: sink }, (envelope) => {
  // stepDefinition -> definitions; testCase.testSteps[i].pickleStepId with stepDefinitionIds:
  //   length 0 -> undefined, length > 1 -> ambiguous, each id -> used
  // gherkinDocument -> style checks; parseError / undefinedParameterType -> findings
});
// unused = definitions not in used. Do NOT trust the run result's `success`: it is true in dry run
// even with AMBIGUOUS and UNDEFINED steps (measured).
```
- `formats.stdout` must stay a real formatter (`""` throws "Failed to import formatter"); discard its output through the sink.
- Measured: about 0.75 s in-process (1.3 s wall) over 13 pickles. No `/tmp/pi-cm-features-*` directory appears, so `BeforeAll` does not run in a dry run and no Pi starts.
- Tag override measured: with `tagExpression: ""`, an Outline with untagged, `@url`, and `@github` Examples yields 4 test cases; with `not @url and not @github` it yields 2 (the untagged rows). `pickle` envelopes are emitted for every pickle regardless of filter, so count `testCase` envelopes.
- Wire it as `"check:features": "node scripts/check-features.mjs"` and append `check:features` to `check:static`'s `run-parallel.mjs` list (`run-parallel` runs npm script names).
- **Gherkin/layout checks from the `gherkinDocument` AST** (`feature.keyword`, `name`, `description`, `children[].background|scenario|rule`, `steps[].keyword|keywordType|text`, `scenario.examples[].tags`):
  - Layout walk of `features/`. Allowed: `features/<fn>/<cap>.feature` (depth 2; `<fn>` not `lib`/`support`/`step_definitions`; a function dir holds only `.feature`); `features/step_definitions/[<fn>/]<name>.steps.ts`; `features/support/[<name>/]...ts`; `features/lib/[<name>/]...ts` (not `.steps.ts`). Everything else fails, including a root `.feature` and `features/AGENTS.md` (current layout.md no longer lists it).
  - Catch-all module/dir names under `step_definitions/`, `support/`, `lib/`: `common`, `shared`, `utils`, `helpers`, `support`, `misc`, plus layout.md's `hooks` and `parameter-types`. **The top-level `features/support/` directory itself is mandated and must be exempt**; the todo's list predates that layout.
  - `<x>.steps.ts` beside a `<x>/` directory fails (layout.md's split rule: "becomes" a directory).
  - Title `Feature: <Function> <capability>`: first word lowercased equals the directory, and the rest kebab-cased equals the basename (`Plugin install` gives `plugin/install.feature`). Description non-empty (features.md asks for two or three lines; all three current features have three).
  - No `keywordType: "Conjunction"` (`And`/`But`) and no `*`/`Unknown`; `Background` steps all `Context`; no `Context` after an `Action`/`Outcome` within a scenario (Background counts as before).
  - Step text: remove `"..."` and `'...'` quoted values, then no `[A-Z]` (features.md: entirely lower case after the keyword); no `\bshould\b`.
  - Scenario (and Outline) titles start `[A-Z]`. Recurse into `rule.children` or forbid `Rule:`.
  - Recommended (SC4 makes it a documented rule): `@url`/`@github` appear **only on `Examples` blocks**, and no other tag exists. A `@url` on a `Scenario Outline` silently excludes its local rows too, and nothing would fail.
- **Current tree passes every check above** (read all three features, 11 modules): titles map to `plugin/{install,uninstall,update}.feature`, three-line descriptions, Given/When/Then only, lower-case text, no `should`, no Given after When, Background Given-only, upper-case titles, no catch-all module names, step modules export nothing, no regex step text, lib imports only `type DataTable`.

### Pattern 6: ESLint blocks (folded §2.1-2.2), measured selectors
```javascript
// eslint.config.js, after the global "**/*.{js,ts}" block (no other block sets these rules for features/)
{
  files: ["features/step_definitions/**/*.steps.ts"],
  rules: {
    "no-restricted-syntax": ["error",
      { selector: "ExportNamedDeclaration, ExportDefaultDeclaration, ExportAllDeclaration, TSExportAssignment",
        message: "A step module exports nothing." },
      { selector: "CallExpression[callee.name=/^(Given|When|Then)$/] > Literal.arguments[regex]",
        message: "Step text uses Cucumber expressions, never regular expressions." },
      { selector: "CallExpression[callee.name=/^(Given|When|Then)$/] > :matches(NewExpression, CallExpression)[callee.name='RegExp']",
        message: "Step text uses Cucumber expressions, never regular expressions." },
    ],
  },
},
{
  files: ["features/lib/**/*.ts"],
  rules: {
    "no-restricted-imports": ["error", { paths: [{ name: "@cucumber/cucumber",
      importNames: ["Given", "When", "Then", "Before", "After", "BeforeAll", "AfterAll", "BeforeStep",
        "AfterStep", "defineStep", "defineParameterType", "setWorldConstructor", "setDefaultTimeout"],
      message: "A library module registers nothing." }] }],
  },
},
```
Measured with `eslint --stdin --stdin-filename features/...`: the export, regex-literal, and non-literal-first-argument selectors all fire; `import type { DataTable }` passes; `import type { When }` is flagged (harmless). A stricter `[arguments.0.type!="Literal"]` selector also rejects a `const` pattern; it goes beyond the folded rule, so it is the planner's call. `prefer-arrow-callback` (global, `error`) does not conflict: a `function` expression that uses `this` is allowed, and steps.md already requires arrows for steps that do not touch the world.

### Anti-Patterns to Avoid
- **Filtering for "the" result** (`payloads.find(...)`): an extra payload passes silently. Single-payload steps assert `length === 1`.
- **Hiding `lastUpdatedAt`** in `UNSTATED_FIELDS`: a regression that stops stamping it passes.
- **Regex or prefix projection** of paths or ports: hides a wrong path or a wrong scope.
- **A shared step module named `shared.steps.ts`**, or keeping `marketplace.steps.ts` beside `marketplace/`: layout.md bans both, and the gate should too.
- **Seeding UPD-02 dir/file rows expecting `updated`**: current code reports `skipped {up-to-date}` for every path-source update while autoupdate is off.
- **`{scenario time}` in an `add` result**: add blocks carry no `details`.
- **Trusting `runCucumber(...).success`** in the gate.
- **Running `npx cucumber-js --dry-run --format usage` as the review check** after `tags` lands: it honors the exclusion and reports steps used only by `@url`/`@github` rows as UNUSED. SKILL.md and steps.md must point at the new gate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gherkin parsing | A line-regex parser | `gherkinDocument` envelopes from `runCucumber` | Keywords, Outlines, Rules, tags, docstrings, and table escapes are already modelled |
| Step matching for usage | Re-implement Cucumber expressions | `testCase.testSteps[].stepDefinitionIds` | Exactly the runner's matching, parameter types included |
| Payload validation | Per-kind hand checks | `Compile(NOTIFICATION_PAYLOAD_SCHEMA)` | The published contract (world-and-stand-ins.md) |
| Profile merging for the gate | A second profile file | `loadConfiguration()` then override `sources.tagExpression` | Tags AND-merge (`merge_configurations.js`: `${wrap(a)} and ${wrap(b)}`); `import` is additive |

**Key insight:** every hand-rolled piece here would drift from the runner's own semantics. The cucumber API reports exactly what `npm run test:cucumber` would match.

## Measured Payload Inventory (Q1)

All payloads below passed `Compile(NOTIFICATION_PAYLOAD_SCHEMA).Check`. Every exchange had `disposition: "handled"`, no extension errors, no dialogs, and no non-`claude-plugin` entries. `origin`/`schemaVersion` are omitted below. `{home}` = sandbox HOME realpath. [VERIFIED: headless Pi probe, Node 26.11.1]

| Command form | Count / kinds (order) | Shape (measured) |
|---|---|---|
| `marketplace list` (nothing added) | 1 `cascade` | `{severity:"info", needsReload:false, marketplaces:[]}`, **no tally** |
| `list` / `ls [--scope S]` | 1 `cascade` | `tally {label:"Marketplace list", failures:0, warnings:0, success:{count:N}}`; blocks `{name, scope, details:{autoupdate, lastUpdatedAt}, plugins:[]}`; project first, then **insertion order** within a scope |
| `add <src> [--scope]` ok (dir or file) | 1 `cascade` | block `{name, scope, status:"added", plugins:[]}`; no `details`, no tally |
| `add` duplicate | 1 `cascade` | `severity:"error"`, `summary:"A marketplace operation has failed."`, block `status:"failed", reasons:["duplicate name"]` |
| `add` missing path | 1 `cascade` | error; block `name:"{home}/marketplaces/nope"` (typed source), `reasons:["source missing"]` |
| `add` invalid manifest (schema or JSON) | 1 `cascade` | error; block `name` = typed source, `reasons:["invalid manifest"]` |
| `add ~/marketplaces/tools --local` | 1 `cascade` | `added`; `claude-plugins.local.json` = `{"schemaVersion":1,"marketplaces":{"tools":{"source":"~/marketplaces/tools"}}}`; **no `claude-plugins.json` created** |
| `remove`/`rm <name>` ok | 1 `cascade` | block `status:"removed"`, `needsReload:false` |
| `remove` with an installed plugin | 1 `cascade` | `needsReload:true`; block `removed` + plugin `{status:"uninstalled", name, id, reasons:[], scope}` (no version) |
| `remove`/`info` name neither scope holds | 1 `marketplace-not-added` | `severity:"error"`, `summary:"A marketplace operation has failed."`, `name`, `reasons:["marketplace not added"]`, **no `scope`** |
| `info N --scope project` when only user holds N | 1 `marketplace-not-added` | `scope:"project"`, `reasons:["marketplace not added to project scope"]` |
| `info N` (one scope) / `info N --scope S` | 1 `marketplace-info` | `{name, scope, details:{autoupdate, lastUpdatedAt}, source:{sourceKind:"path", absPath:"{home}/marketplaces/N"}, description?}`. **file kind shows the root dir, not the json path** |
| `info N`, both scopes healthy | 1 `marketplace-info-cascade` | `blocks:[project, user]` |
| `info N`, manifest schema-invalid | 1 `plugin-info` | error, `summary:"A plugin operation has failed."`, `marketplaceDetails:{autoupdate}` (no lastUpdatedAt), `plugin:{status:"failed", name:N, id:"N@N", reasons:["invalid manifest"], scope, componentsResolved:false}` |
| `info N`, corrupt JSON / dir gone | 1 `plugin-info` | `reasons:["unparseable"]` / `["source missing"]` |
| `info N`, both scopes, both broken | **2** `plugin-info` | project, then user |
| `info N`, both scopes, project broken | **2**: `marketplace-info`, `plugin-info` | **healthy (user) first**, then the failure (project) |
| `update N [--scope]` unchanged | 1 `cascade` | block `status:"skipped", reasons:["up-to-date"]`; no tally |
| `update N`, path manifest changed, autoupdate off | 1 `cascade` | **still `skipped {up-to-date}`** (see Pitfall 1) |
| `update N`, autoupdate on, plugin version changed | 1 `cascade` | `needsReload:true`; block `updated` + plugin `{status:"updated", from, to}` |
| `update N`, autoupdate on, installed plugin dropped | 1 `cascade` | `severity:"warning"`, `summary:"A plugin operation needs attention."`, plugin `skipped`, `reasons:["not in manifest"]` |
| `update N`, schema-invalid | 1 `cascade` | error, `summary:"Some operations have failed."`, block `failed` + plugin `{name:N, id:"N@N", status:"failed", reasons:["invalid manifest"], cause:{causeChain:["Failed to update marketplace \"N\".","marketplace.json schema invalid: /plugins: must be array"], truncated:false}, leaks:[], rollbackPartial:[]}` |
| `update N`, dir vanished | 1 `cascade` | `reasons:["source missing"]`, cause `ENOENT: no such file or directory, open '{home}/.../.claude-plugin/marketplace.json'` |
| `update N` without `--scope`, both scopes hold N | 1 `cascade` | project block only |
| `update` bare, nothing added | 1 `cascade` | `marketplaces:[]`, no tally |
| `update` bare, N marketplaces | **N** `cascade` | each `tally {label:"Marketplace update", failures:0, warnings:0, success:{count:1}}` + one block; **project scope first, then insertion (add) order within a scope** (`update.ts:262-272`: `Object.keys(state.marketplaces)`, not sorted) |
| `autoupdate N` (no scope, both hold) | 1 `cascade` | 2 blocks `status:"autoupdate enabled"` (project, user) |
| `autoupdate` bare | 1 `cascade` | `tally {label:"Marketplace autoupdate", ...}`; blocks `autoupdate enabled` or `skipped ["already autoupdate"]` |
| `autoupdate`/`noautoupdate` bare, nothing added | 1 `cascade` | `marketplaces:[]` |
| `noautoupdate N` on a new marketplace | 1 `cascade` | `skipped ["already no autoupdate"]` |
| `noautoupdate N --scope user` (on) | 1 `cascade` | `status:"autoupdate disabled"` |
| `marketplace help`, `help marketplace` | 1 `usage-info` | `{severity:"info", needsReload:false, usage: MARKETPLACE_USAGE}` |
| `marketplace` | 1 `usage-error` | `message:"marketplace requires a subcommand."`, `usage: MARKETPLACE_USAGE` |
| `marketplace frobnicate` | 1 `usage-error` | `message:"Unknown marketplace subcommand: \"frobnicate\"."` |
| `marketplace add` | 1 `usage-error` | `"Missing required argument."`, `usage:"Usage: /claude:plugin marketplace add <source> [--scope user\|project] [--local]"` |
| `marketplace help extra` | 1 `usage-error` | `"marketplace help takes no arguments."`, `usage:"Usage: /claude:plugin marketplace help"` |
| `marketplace list --local` | 1 `usage-error` | `"Unknown flag: \"--local\"."`, `usage:"Usage: /claude:plugin marketplace <list\|ls> [--scope user\|project]"` |
| `marketplace update ""` | 1 `usage-error` | `"Argument must not be empty."` |

**No `mcp-config-notices`** appeared in any command, including install, uninstall-by-remove, and autoupdate cascades, in the clean sandbox. `MARKETPLACE_USAGE` is quoted verbatim from `edge/router.ts:129-137`: `"Usage: /claude:plugin marketplace <add|remove|rm|list|ls|info|update|autoupdate|noautoupdate> ...\n" + "  add <source> [--scope user|project]\n" + ... + "  noautoupdate [<name>] [--scope user|project]"`. [VERIFIED: router.ts:129-137]

Schema facts used above [VERIFIED: notification-wire.ts]: `MARKETPLACE_DETAILS = { autoupdate: Type.Boolean(), lastUpdatedAt: Type.Optional(Type.String()) }` (291-294); `MARKETPLACE_BLOCK` has `name, scope, plugins, status?, details?, reasons?` (297-307); `ENVELOPE_FIELDS` has `summary: Type.Optional(Type.String())` (348-354); `RAW_ENVELOPE_FIELDS` (no summary) for `usage-error` (`message`, `usage`) and `usage-info` (`usage`) (588-608); `MARKETPLACE_INFO_CASCADE_PAYLOAD.blocks` `minItems: 1` (523-532); `MARKETPLACE_NOT_ADDED_PAYLOAD` `scope: Type.Optional(SCOPE)`, `reasons: Type.Array(REASON)` (546-555); the union starts `NOTIFICATION_PAYLOAD_SCHEMA = Type.Union([ CASCADE_PAYLOAD_SCHEMA, RECONCILE_APPLIED_PAYLOAD, MARKETPLACE_INFO_PAYLOAD, PLUGIN_INFO_PAYLOAD, MARKETPLACE_INFO_CASCADE_PAYLOAD, ...` (800-833).

Config paths [VERIFIED: persistence/locations.ts:203,219-220]: `const scopeRoot = scope === "user" ? getAgentDir() : path.join(cwd, ".pi");`, `path.join(scopeRoot, "claude-plugins.json")`, `path.join(scopeRoot, "claude-plugins.local.json")`. So user = `<agentDir>/claude-plugins.json`, project = `<cwd>/.pi/claude-plugins.json`. Measured content: `{"schemaVersion":1,"marketplaces":{"tools":{"source":"<typed>","autoupdate":true}},"plugins":{"demo@tools":{}}}`. The `autoupdate` key is written by add (`false`) and by autoupdate; it is absent in the local file.

## D-06 Shared-Step Inventory (Q2)

| Step (wording: the writer's) | Needed by (requirement, phase) | Module | Status |
|---|---|---|---|
| publish as a `<kind>` source (records kind) | ADD-01..07 (P3), RM-01 (P4), INFO-01..03 (P5), UPD-01/02 (P6), AU-03 (P7) | marketplace/publishing | NEW |
| `the marketplace {string} offers these plugins:` (kind-aware republish) | plugin features, RM-02 (P4), UPD-02/03/04/06/13 (P6) | marketplace/publishing | RESHAPE (root under `{home}`, recorded kind) |
| `the marketplace {string} is added to the {word} scope` | P4, P5, P6, P7, plugin features | marketplace/publishing | RESHAPE (types recorded source) |
| manifest becomes invalid (schema-invalid) | INFO-08 (P5), UPD-10 (P6) | marketplace/publishing | NEW |
| `the user has run {string}` (setup incl. plugin install) | RM-02 (P4), UPD-03/04/13 (P6), AU (P7), plugin | command | RESHAPE (token expansion) |
| `the user runs {string}` | all | command | RESHAPE (all payloads, tokens) |
| `the result has these fields:` (kind stated) | all; covers not-added, info, plugin-info, usage | command | RESHAPE (D-01, projection) |
| `the result lists these plugins:` | RM-02 (P4), UPD-04/13 (P6), plugin | command | RESHAPE (projection, kind assert) |
| `the result lists these marketplaces:` | ADD (P3), RM/LS (P4), UPD (P6), AU (P7) | marketplace/results | NEW |
| `the result lists no marketplaces` | LS-01 (P4), UPD-08 (P6), AU-07 (P7) | marketplace/results | NEW |
| envelope table (one row per payload) | UPD-07 (P6), INFO fan-out with a broken scope (P5) | command | NEW (D-02) |
| rows across payloads | UPD-07 (P6) (+ plugin rows with autoupdate) | command | NEW (D-02) |
| `the <scope> scope declares these marketplaces:` (claude-plugins.json; local variant) | ADD-13/14 (P3), GHB-04 / Phase 10 SC1 | config | NEW (D-07, read only) |
| `Given the user has started a new pi session` | ADD-03 (P3), RM-04 (P4), AU-05 (P7) | session | NEW |
| `When the user starts a new pi session`, `the session offers these skills:` / `no skills` | RM-03 (P4), UPD-04 (P6) | session | EXISTING |
| **Verb-local (not shared):** dir vanishes (UPD-14, P6), info-cascade blocks (INFO-04, P5), usage docstring if wanted (P8), malformed-at-publish (ADD-07, P3; calls the lib dispatcher) | one phase each | `<verb>.steps.ts` | verb phase |

**Minimal seed set (every NEW/RESHAPED step used by at least one scenario; files then owned by their verb phase):**

| # | Feature file | Scenario (requirement) | Proves / first use of |
|---|---|---|---|
| 1 | `marketplace/add.feature` | ADD-01 Outline: untagged `dir`, `file`; `@url`; `@github` blocks | publish-as-kind, `the user runs` expansion via `<source>`, kind row, `lists these marketplaces` (name, scope, status), **SC4 tag exclusion** |
| 2 | `marketplace/add.feature` | ADD-14 (`~` kept; config shows `~/marketplaces/tools`) or ADD-13 (local file) | config read step (one definition with a file/scope parameter, or one seed per definition) |
| 3 | `marketplace/add.feature` | ADD-03 (dir, file, `@url` rows): appears in `list` after a new session | `Given the user has started a new pi session`, `{scenario time}` in list rows |
| 4 | `marketplace/list.feature` | LS-01 (nothing added) | `lists no marketplaces` |
| 5 | `marketplace/list.feature` | LS-02 (both scopes, project first, autoupdate + `{scenario time}`, tally fields) | `is added to the {word} scope` (reshaped), time window |
| 6 | `marketplace/info.feature` | INFO-01 (dir/file Outline rows; `source abs path` = `{home}/marketplaces/tools` for both) | `{home}` **projection**, `marketplace-info` kind |
| 7 | `marketplace/info.feature` or `update.feature` | INFO-08 (`plugin-info`, `invalid manifest`) or UPD-10 | becomes-invalid step |
| 8 | `marketplace/update.feature` | UPD-07 (three marketplaces across both scopes; expected order = project, then add order) | envelope + rows-across-payloads steps, DRV-01's multi-payload |

Optional, cheap kind-coverage seeds using only `has these fields:`: INFO-05 (`marketplace-not-added`), USE-03 (`usage-error`), USE-01 (`usage-info`, multi-line cell). Merge seeds where one scenario honestly covers two (e.g. 3 and 5) to stay minimal. Plugin features: add `| kind | cascade |` to each of the 10 `has these fields:` tables.

## Runtime State Inventory

Not a rename/migration phase, but fixtures move:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. The per-run sandbox under `/tmp/pi-cm-features-*` is deleted in `AfterAll` | none |
| Live service config | None | none |
| OS-registered state | None | none |
| Secrets/env vars | None. The Pi child env is the `_rpc.ts:167-174` allowlist (`HOME`, `PI_CODING_AGENT_DIR`, `PI_OFFLINE: "1"`, `PATH`) | none |
| Build artifacts | ESLint cache `node_modules/.cache/eslint/` keys on config content, so the new blocks invalidate it automatically | none |

## Common Pitfalls

### Pitfall 1: Path-source `update` cannot report `updated` with autoupdate off
**What goes wrong:** UPD-02's dir/file rows expect `updated`; current code always emits `skipped {up-to-date}`.
**Why:** `refreshRecord` computes `preKey = await manifestContentKey(record)` (`update.ts:387`) by reading `record.manifestPath`, the live file, which the user already rewrote; `postKey` reads the same file. Measured three times (version bump with size change, new plugin set, bare update). With autoupdate **on**, the plugin cascade makes it `updated`.
**How to avoid:** Phase 1 seeds no UPD-02 path row. Flag to Phase 6 as a C-10-like ruling (bug vs pinned behavior).

### Pitfall 2: Nominal vs realpath sandbox
**What goes wrong:** `{home}` projection misses on macOS (`/var` vs `/private/var`), or `Before()` empties a different path than Pi uses.
**How to avoid:** `const root = await realpath(await mkdtemp(...))` in `BeforeAll`.

### Pitfall 3: The skill's manual usage check lies after `tags` lands
**What goes wrong:** SKILL.md ("Run `npx cucumber-js --dry-run --format usage`") and steps.md describe a check that honors `not @url and not @github`, so a reviewer sees false UNUSED for steps only `@url`/`@github` rows use.
**How to avoid:** Update both to name `npm run check:features` (or `check:static`), with the D-09 rationale.

### Pitfall 4: Outline "three or more variants" vs two-kind requirements
**What goes wrong:** ADD-03/04/07 and RM-01 are "(dir, url)"; a dir + `@url` Outline has two variants, and features.md requires three or more.
**How to avoid:** Add the `file` row (cheap; same path fixture), or state in the SC4 multi-kind section that every Examples row counts, tagged or not. Decide once in the skill text.

### Pitfall 5: Empty results and header-only tables
**What goes wrong:** `namesLike` builds columns from records; zero blocks give `[[]]`, so `| name | scope |` with no rows can never pass.
**How to avoid:** `the result lists no marketplaces` step.

### Pitfall 6: fallow sees `features/` as reachable
`fallow dead-code --trace features/lib/pi-commands.ts:runCommand` reports "reachable (entry point)", so an unused export in `features/lib/` fails `npm run fallow`. Every new lib export needs a consumer in the same plan; if the widened driver leaves `runCommand` used only by `Before()`, that is still a use. fallow `health` (cognitive 15, cyclomatic 20) and `dupes` (threshold 3) also cover `features/**` and `scripts/check-features.mjs`, so split the gate into small functions.

### Pitfall 7: Runtime-composed text in seeds
Corrupt-JSON cause chains carry V8 text (`Expected property name or '}' in JSON at position 2 (line 1 column 3)`). It was identical on Node 22.22.2 and 26.11.1 (measured), and Node 24 (CI) was not measured. Prefer schema-invalid manifests, whose text is extension-composed. ENOENT `open '<path>'` text was identical on 22 and 26.

### Pitfall 8: Info fan-out order is not "project first" when a block fails
Measured: the healthy `marketplace-info` (user) precedes the failing `plugin-info` (project). Phase 5 must not assume project-first for mixed results; the envelope step pins whatever order is real.

### Pitfall 9: Tokens in definitions; quotes in commands
`{home}` inside a step-definition string is a Cucumber parameter and fails as undefined. A command containing `""` (USE-07) needs the single-quoted `{string}` form: `'/claude:plugin marketplace update ""'`. The gate's lower-case check must strip both quote styles.

## Code Examples

### Leaf projection (shape)
```typescript
// Source: derived from features/step_definitions/command.steps.ts flatten/cell (lines 33-58)
function projectLeaf(key: string, value: string, run: { home: string; startedAt: number }): string {
  if (key === "lastUpdatedAt" && isScenarioTime(value, run.startedAt)) {
    return "{scenario time}";
  }

  return value.replaceAll(run.home, "{home}");
}

function isScenarioTime(value: string, startedAt: number): boolean {
  const at = Date.parse(value);
  return !Number.isNaN(at) && new Date(at).toISOString() === value && at >= startedAt && at <= Date.now();
}
```

### cucumber.json
```json
{
  "default": {
    "import": ["features/support/**/*.ts", "features/step_definitions/**/*.steps.ts"],
    "format": ["summary"],
    "order": "random",
    "parallel": 8,
    "tags": "not @url and not @github"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `runCommand`: exactly one `cascade` | `runCommandPayloads` + strict wrapper | this phase | marketplace kinds and multi-payload commands become assertable |
| `kind` hidden in `UNSTATED_FIELDS` | `kind` stated in every fields table (D-01) | this phase | a wrong payload kind fails |
| Manual `--dry-run --format usage` review | `scripts/check-features.mjs` in `check:static` | this phase | unused/undefined/ambiguous fail at commit |
| Fixtures under `<root>/marketplaces` (outside HOME) | `{home}/marketplaces/<name>` | this phase | `Before()` already empties them; typed via `{home}` |

**Deprecated/outdated:** PITFALLS.md's "bare update ... in sorted order" is wrong; the order is insertion order within a scope (measured; `update.ts:270`). The CONTEXT illustrative add example's `last updated at` column does not exist on add results.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | macOS `tmpdir()` is a symlinked path, so realpath matters | Pattern 2, Pitfall 2 | Low: realpath is harmless on Linux |
| A2 | Node 24 (CI) produces the same V8 JSON and ENOENT message text as Node 22/26 | Pitfall 7 | Low if seeds use schema-invalid manifests |
| A3 | Cucumber constructs the world before `Before()` hooks, so a field initializer is a valid scenario start | Pattern 2 | Low: an alternative is setting `startedAt` in the first `Before()` (it is also before any Given) |

## Open Questions

1. **Path-source `update` change detection (Pitfall 1).** Known: current code never emits `updated` for dir/file with autoupdate off. Unclear: bug or accepted? Recommendation: raise it with the user before Phase 6 writes UPD-02; Phase 1 avoids it.
2. **Missing config file vs empty map.** `add --local` creates only `claude-plugins.local.json`. Should "declares no marketplaces" accept a missing file? Recommendation: the read step treats a missing file as "the user's file declares nothing" and documents it, or adds a separate "has no claude-plugins.json" step only if a requirement needs it.
3. **SC4 "which phase removes each tag" in durable skill text.** Comments and docs avoid phase numbers. Recommendation: the skill names the stand-in that lifts each tag (the HTTPS git stand-in lifts `@url`; the GitHub base override plus the stand-in lifts `@github`) and points to ROADMAP for phases.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | suite, gate | yes | 26.11.1 (`node`), 22.22.2 (`/usr/bin/node`) | Node 24 only in CI |
| `@cucumber/cucumber` | suite, gate | yes | 13.3.0 | — |
| git | not needed this phase | yes | 2.55.0 | — |
| Network | none | — | — | — |

No missing dependencies. The whole suite and the gate passed on Node 22.22.2 too (13/13, 7.8 s wall).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | cucumber-js 13.3.0 (behavioral) + the new `scripts/check-features.mjs` gate + ESLint 10 |
| Config file | `cucumber.json` (default profile; gains `tags`) |
| Quick run command | `npx cucumber-js --name '<scenario title>'`; `npm run check:features` (about 1.3 s) |
| Full suite command | `npm run test:cucumber` (5.6 s wall today, 13 scenarios); phase gate `npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DRV-01 | every payload returned, schema-validated; kind and count asserted; one per marketplace from bare update | behavioral | `npm run test:cucumber` (seeds 1, 6, 7, 8 + the 13 plugin scenarios with `kind` rows) | ❌ Wave 0: `features/marketplace/{add,info,update}.feature` |
| DRV-02 | `{home}` both directions; `{scenario time}` window | behavioral | `npx cucumber-js --name '<INFO-01 title>'`, `--name '<LS-02 title>'` | ❌ Wave 0: `features/marketplace/{info,list}.feature` |
| DRV-04 | unused/undefined/ambiguous fails | static gate | `npm run check:features`; `npm run check:static` | ❌ Wave 0: `scripts/check-features.mjs`, `package.json` script |
| folded §2.3 | Gherkin/layout rules | static gate | `npm run check:features` | ❌ (same script) |
| folded §2.1-2.2 | step modules export nothing / no regex; lib registers nothing | lint | `npm run lint` | ❌ Wave 0: `eslint.config.js` blocks |
| SC4 | local rows run, `@url`/`@github` excluded | behavioral | `npm run test:cucumber` (ADD-01 shows only dir/file rows in the scenario count); `check:features` still sees all rows | ❌ |

**One-time manual negative checks (never committed, per CONVENTIONS):** a wrong `| kind |` row, an extra payload (a multi-payload command under a single-payload step), a stale `last updated at` literal, a step text typo (undefined), a duplicate definition (ambiguous), an orphan definition (unused), an `And` step, an upper-case step, a regex step pattern, an export in a step module, and a `Given` import in `features/lib`. Each must fail its gate once; record the result in the plan SUMMARY.

### Sampling Rate
- **Per task commit:** the hook runs `check:commit` (includes `check:static`, which includes `check:features`); also run `npm run test:cucumber` by hand for any `features/` change, since the hook skips it.
- **Per wave merge:** `npm run check` (includes `test:cucumber`).
- **Phase gate:** `npm run check` green on the combined tree; optionally once with `/usr/bin/node` (22) to catch runtime drift.

### Wave 0 Gaps
- [ ] `scripts/check-features.mjs` + `check:features` npm script + `check:static` list entry
- [ ] `eslint.config.js` `features/step_definitions/**/*.steps.ts` and `features/lib/**/*.ts` blocks
- [ ] `cucumber.json` `tags`
- [ ] Seed feature files under `features/marketplace/`
- [ ] `.agents/skills/cucumber/` updates (SKILL.md review command, steps.md usage line, features.md multi-kind Outline + tokens, world-and-stand-ins.md token/driver mechanism); `.agents/skills/local-verification/rules/commands.md` lists the new `check:static` member

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Schema-validate every payload before a step reads it (`Compile(NOTIFICATION_PAYLOAD_SCHEMA)`) |
| V6 Cryptography | no | — |
| V12 Files and resources | yes | Sandbox containment: `_rpc.ts` `resolveSandbox` refuses locations outside `tmpdir()` or inside the repo; fixtures only under the run's HOME |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A scenario touching the developer's real `~/.pi/agent` or HOME | Tampering | Allowlisted child env (`_rpc.ts:167-174`), realpath'd temp sandbox, `Before()` reset asserts empty |
| Over-broad projection hiding a wrong path (a false pass) | Repudiation/Integrity | Exact-substring projection of one realpath; key-scoped time window |
| A gate that reports green on a failing tree | Integrity | Gate computes its own verdict; never trusts dry-run `success` |

## Sources

### Primary (HIGH confidence)
- Headless Pi probes (scratchpad, not committed): 8 command scripts over the real extension, Node 26.11.1; cause-chain comparison on Node 22.22.2.
- cucumber API probes: `loadConfiguration` + `runCucumber` dry run, tag override, planted undefined/ambiguous/Examples-tag feature in the scratchpad.
- `node_modules/@cucumber/cucumber/lib/configuration/merge_configurations.js` (tags AND-merge), `lib/api/*.d.ts`.
- ESLint stdin runs with the proposed selectors.
- Source read: `features/**` (all 11 files), `tests/e2e/_rpc.ts:115-175,345-405`, `shared/notification-wire.ts:280-833`, `orchestrators/marketplace/update.ts:257-300,350-460,700-830`, `persistence/locations.ts:200-221`, `edge/router.ts:125-137`, `domain/source.ts:340-365`, `domain/manifest-cache.ts`, `shared/redact-absolute-paths.ts`, `shared/notification-present.ts:130-200`, `eslint.config.js`, `package.json`, `cucumber.json`, `.pre-commit-config.yaml:100-112`, `.github/workflows/ci.yml:1-40`, `scripts/run-parallel.mjs`, `.fallowrc.json`.
- `fallow dead-code --trace features/lib/pi-commands.ts:runCommand`.

### Secondary (MEDIUM confidence)
- `.planning/research/{SUMMARY,ARCHITECTURE,PITFALLS,FEATURES}.md` (cross-checked; one claim corrected: bare-update order).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (installed versions read; no new packages)
- Architecture: HIGH (payload shapes, order, gate mechanics, and selectors measured)
- Pitfalls: HIGH (each reproduced), except A1/A2 (LOW, platform/runtime not available)

**Research date:** 2026-10-15
**Valid until:** 2026-11-14 (stable; re-measure if `notification-wire.ts`, `update.ts`, or cucumber-js changes)
