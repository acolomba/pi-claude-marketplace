# Phase 10: Plugin Options, Variables, and Trust - Pattern Map

**Mapped:** 2026-11-14
**Files analyzed:** 41 (new or modified, test pairs counted with their source)
**Analogs found:** 40 / 41

Every path below is relative to `/home/acolomba/src/pi-claude-marketplace-gaps-mcp`. `E/` = `extensions/pi-claude-marketplace/`. All analogs are git-tracked source. Line numbers were read on `features/gaps-mcp` on 2026-11-14.

Order the waves the way RESEARCH recommends: the two harness additions and the adapter conformance case (A1) first, then `domain/user-config.ts` with its pair, then the record field and the resolver arms with the reason token, then the three consumers (content, hooks, MCP), then `PATH` and CORE-05 (independent of the options work, so they can run beside it), then docs and records.

## Mapper findings the planner must see

These came out of reading the analogs. RESEARCH does not list them.

1. **The record field has five write sites, not two.** RESEARCH names `statePhase` and `update-swap.ts`. `mcpServerConfigs` is also written by the disabled-plugin refresh (`E/orchestrators/plugin/update-preflight.ts:798-807` `DISABLED_PIN_FIELDS`, `:811-825` projection, `:927` write), by the AMIG-01 move (`E/orchestrators/reconcile/mcp-migration.ts:579`), and restored by `apply` (`E/orchestrators/reconcile/apply.ts:1963`, which reads `DISABLED_PIN_FIELDS`). `userConfig` must join `DISABLED_PIN_FIELDS` and its projection, or a disabled plugin's update leaves a stale option schema.
2. **The reason vocabulary has six homes, not four.** Besides the four RESEARCH lists: the wire map `E/shared/notification-wire.ts:151` (`"unsupported mcp": true`), and the local `UnsupportedReason` union in `E/shared/probe-classifiers.ts:76-77` (separate from the one in `notify-reasons.ts:117`). The catalog fixtures under `test/architecture/catalog-uat/fixtures/plugin-{install,list,info}.ts` hold one row per reason.
3. **`shared/` cannot import `domain/`.** `shared/vars.ts` is a leaf. The option input of `substituteClaudeVars` must be a plain structural type declared in `shared/vars.ts` (for example a values map and a sensitive set), which `domain/user-config.ts` produces. Do not import `ResolvedOptions` into `shared/`.
4. **The MCP notice types pin `file: "mcp-adapter.json"`.** Every notice with a server subject carries that literal (`E/shared/notification-types.ts:1418-1425`). Under Pi's built-in MCP a dropped server has no file. Decide the built-in wording before copying the shape; `builtin-entry` returning `undefined` already means "not registered" and emits nothing today.
5. **`variables-missing` is the closer payload shape** for the drop notice: it carries `names: STRINGS` (a list of keys), where `ca-file-removed` carries one closed `reason`. Use the `ca-file-removed` chain for the list of homes to touch, and the `variables-missing` member for the payload.
6. **Project-scope option variables need a trust answer at `session_start`.** `index.ts:271` runs `applyMcpAdapterEnvFrom(() => ctx.cwd)` with no trust read, and `test/index.test.ts:342-368` counts `ctx.isProjectTrusted()` calls with a strong mock (`TRUST_READS_PER_DISCOVER`). D-PG10-23 sets project variables "once the load's trust answer is true". The cheapest site is `prepareResources` (`index.ts:163`), which already holds `projectTrusted`. A new read in `session_start` changes every `trustReads` expectation.
7. **A typed kind falls into `unsupported component` by default.** `kindToReason` (`E/shared/probe-classifiers.ts:237-251`) maps any kind outside three carve-outs to `unsupported component`. If the required-option arm pushes a kind into `partial.unsupported`, the new token needs its own arm there. If it pushes only a note, it needs the `startsWith` arm in both note classifiers.
8. **The untrusted profile step asserts that `trust.json` does not exist** (`features/step_definitions/model.steps.ts:78-80`). A "Do not trust" profile is a third value, not a change to that step.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `E/domain/user-config.ts` (NEW) + `test/domain/user-config.test.ts` (NEW) | domain parser/utility | transform | `E/domain/dependencies.ts` + `test/domain/dependencies.test.ts`; schema style from `E/domain/mcp-server-features.ts:20-21` and `E/domain/components/plugin.ts` | role-match |
| `E/domain/components/plugin.ts` (`userConfig` leaves `UNSUPPORTED_COMPONENT_FIELDS`) | model/schema | transform | same file, `McpServersField` `:48-53` | exact |
| `E/domain/unsupported-components.ts` (remove member, move audit note) | domain closed set | transform | same file `:38-49`, `:8-36` | exact |
| `E/domain/plugin-resolver.ts`, `resolver-types.ts` (malformed arm, required-option arm) | domain resolver | transform | `addUnsupportedKindNotes` `:697-722`, `runStructuralStages` `:828-859`, `decideResolution` `:867-883`; entry-or-manifest rule `E/domain/mcp-resolution.ts:441` | exact |
| Reason token: `E/shared/notification-types.ts`, `notify-reasons.ts`, `probe-classifiers.ts`, `notification-wire.ts`, `E/orchestrators/plugin/install.messaging.ts` + lock tests + docs | closed vocabulary | transform | `unsupported mcp` (ANAME-07) across the same homes | exact |
| `E/persistence/state-io.ts` (record field `userConfig`) | model/persistence | CRUD | `mcpServerConfigs` `:143-156`, `mcpServerConfigsOf` `:294-307` | exact |
| `E/orchestrators/plugin/install-outcome.ts` (`statePhase`), `update-swap.ts`, `update-preflight.ts`, `reconcile/mcp-migration.ts` (record writers) | orchestrator | CRUD | their `mcpServerConfigs` lines (`:1669`, `:956`, `:798-927`, `:579`) | exact |
| `E/shared/vars.ts` + content stagers (`bridges/skills/stage.ts`, `bridges/commands/staged-command.ts`, `bridges/agents/convert.ts`, `bridges/agents/skill-preload.ts`) | utility + bridge | transform | `substituteClaudeVars` `:68-73`, `ClaudePluginVars` `:26-31` | exact |
| `E/bridges/hooks/hook-env.ts`, `spawn-helpers.ts`, `routing-state.ts`, `event-router.ts` | bridge | event-driven | `prepareHookEnv` `:75-104`; `planSpawn` `:52-57`; `CacheEntry` `routing-state.ts:90-110`; producers `event-router.ts:218-225`, `:779-786` | exact |
| `E/domain/claude-mcp-variables.ts`, `E/bridges/mcp/{substitute,adapter-entry,builtin-entry,stage}.ts` | domain + bridge | transform | `expandClaudeValue` `:222-246`, `ExpandedValue` `:80-84`, `Segment` `:48-50` | exact |
| MCP drop notice: `E/shared/notification-{types,mcp,wire,resolve,json}.ts`, `bridges/mcp/stage.ts`, `orchestrators/marketplace/shared.ts` | notification | event-driven | `ca-file-removed` (D-PG9-14) chain; payload from `variables-missing` | exact |
| `E/shared/session-env.ts` (owned-variable ledger core) | utility | transform | `applyPathLedger` `:159-192`, `PATH_LEDGER_ENV` `:73`, `applyMcpAdapterEnv` `:118-135` | exact |
| `E/orchestrators/plugin-options.ts` (NEW) + `test/orchestrators/plugin-options.test.ts` (NEW) | orchestrator I/O shell | file-I/O (state read) | `E/orchestrators/plugin-path.ts` + `test/orchestrators/plugin-path.test.ts` | exact |
| `E/orchestrators/plugin-path.ts` (trust input, stat filter) | orchestrator | file-I/O | same file `:87-116`, `collectBinDirs` `:35-62` | exact |
| `E/index.ts` (pass `projectTrusted`, set option variables) | entry | event-driven | `:91`, `:163-179`, `:199`, `:271` | exact |
| `E/orchestrators/skill-invocation.ts:151`, `command-invocation.ts:164-166` | orchestrator | request-response | the two gates themselves | exact |
| `E/shared/completion-cache.ts` (`schemaVersion` 7 to 8) | utility | file-I/O | same file `:92`, `:331`, `:350`; header note `:60-70` | exact |
| `features/support/world.ts`, `features/step_definitions/model.steps.ts` ("Do not trust" profile) | test harness | file-I/O | `trustSandboxProject` `world.ts:980-986`; untrusted step `model.steps.ts:73-82` | exact |
| `features/step_definitions/plugin/publishing.steps.ts` (+ `features/lib/published-marketplace.ts`) (executable file step) | step defs | file-I/O | generic file step `publishing.steps.ts:328-338`; chmod precedent `features/lib/hook-files.ts:521-533` | role-match |
| `features/plugin/options.feature` (NEW) | behavioral test | - | `features/plugin/partial-install.feature:1-48` | role-match |
| `features/plugin/executables.feature` (NEW); new scenario in `features/plugin/project-trust.feature` | behavioral test | - | `features/plugin/project-trust.feature:1-42` | role-match |
| `features/mcp-server/options.feature` (NEW) + own step module | behavioral test | request-response | `features/mcp-server/configuration.feature` (`@mcp` `:10`, pairs `:486-540`, `:616-660`); file shape of `features/mcp-server/resources.feature` | role-match |
| `features/hook/process.feature`, `features/hook/failures.feature` | behavioral test | - | `process.feature:7-28` | exact |
| CORE-05 scenarios in `features/slash-command/{invocation,model-runs}.feature`, `features/skill/model-reads.feature`, `features/agent/listing.feature` | behavioral test | - | project-scope scenarios `features/skill/invocation.feature:178`, `features/slash-command/invocation.feature:88` | exact |
| `test/integration/adapter-expansion-conformance.test.ts` (A1 case) | integration test | transform | existing cases in the same file | exact |
| `.planning/upstream/pi-extension-trust-paths.md` (NEW) | upstream draft | - | `.planning/upstream/pi-mcp-adapter-per-server-sampling.md` | exact |
| `.planning/PROJECT.md`, `.planning/BACKLOG.md`, `CHANGELOG.md`, `docs/{env-vars,hooks-compatibility,mcp-compatibility,output-catalog,json-output}.md` | records/docs | - | D-PG9 rows `PROJECT.md:2396-2401`; `BACKLOG.md:5329`; `CHANGELOG.md:5-13` | exact |

## Pattern Assignments

### `E/domain/user-config.ts` + `test/domain/user-config.test.ts` (NEW pair)

**Analog:** `E/domain/dependencies.ts` (a pure parser of one opaque manifest field, `unknown` at the boundary).

**Header pattern** (`dependencies.ts:1-26`): a `//` block that names the field, why the schema keeps it `Type.Unknown()`, and why the parse lives in `domain/`:
```typescript
// domain/dependencies.ts
//
// The element parser for a plugin's `dependencies` field (DEPS-01, DEPS-02).
// The schema keeps that field `Type.Unknown()` on both the marketplace entry
// and the standalone manifest, so any shape can arrive and the parser accepts
// `unknown` at its boundary rather than a schema-derived type.
// ...
// D-01-20 puts the parse in `domain/` because it is pure: no I/O, no clock,
```
Cite D-PG10-05, D-PG10-19, and "Claude Code 2.1.323" here. Do not cite phase or plan numbers.

**Pattern constants with a doc comment each** (`dependencies.ts:42-47`):
```typescript
/**
 * Upstream's dependency-token alphabet, bounded to 256 characters. ...
 */
const TOKEN_PATTERN = /^[A-Za-z0-9][-A-Za-z0-9._]{0,255}$/;
```
The option key regex `/^[A-Za-z_]\w*$/` and the reference pattern `/\$\{user_config\.([^}]+)\}/g` follow this shape, each marked verbatim from the binary. For a regex ESLint wants shortened, copy `E/domain/claude-mcp-variables.ts:86-89`:
```typescript
// Claude Code 2.1.291's grammar, verbatim, so it can be compared with the
// binary's text.
// eslint-disable-next-line sonarjs/concise-regex -- kept verbatim from Claude Code
const CLAUDE_VARIABLE = /\$\{([A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?)\}/g;
```

**Typebox import and compile** (`E/domain/mcp-server-features.ts:20-21`, `E/domain/components/mcp.ts:23`):
```typescript
import Type from "typebox";
import { Compile } from "typebox/compile";
// ...
export const MCP_SERVER_MAP_VALIDATOR = Compile(MCP_SERVER_MAP_SCHEMA);
```
Compile the option schema once as a module constant. The strict object is `{ additionalProperties: false }` (the form `notification-wire.ts:757` uses). The `options` rules of E1 are small functions beside the schema, not schema keywords.

**Verdict shape for "malformed, with a detail"** (`mcp-server-features.ts:52-56`):
```typescript
export type McpServerVerdict =
  | { readonly kind: "supported" }
  | { readonly kind: "blocked"; readonly feature: McpUnsupportedFeature }
  | { readonly kind: "malformed"; readonly detail: string };
```
Return a discriminated result from the parser (`ok` with the option map, or `malformed` with a detail that names the first bad key or field). The resolver turns the detail into a note.

**Own-key discipline** (`E/persistence/state-io.ts:294-307`): "`Object.entries` reads own keys, so a server named `__proto__` stays a server." The option key regex admits `__proto__`. Return `ReadonlyMap`s (RESEARCH Pattern 1) and read input with `Object.entries` or `Object.hasOwn`.

**Module contents** (RESEARCH Pattern 1): the parse; `resolveOptions(schema)` giving `values` (hooks and content), `mcpValues` (`Jgt`'s map), `unsetRequired`, `sensitive`; the value text (`String(value)`); the hook variable name (`replace(/[^A-Za-z0-9_]/g, "_").toUpperCase()`); the owned process variable name (`PI_CLAUDE_MARKETPLACE_OPTION_<16 hex>`, `node:crypto` sha256). Keep `values` and `mcpValues` as separate members (D-PG10-19).

**Test analog:** `test/domain/dependencies.test.ts:1-40`.
```typescript
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  isRenderableDependencyToken,
  // ...
  type DeclaredDependency,
} from "../../extensions/pi-claude-marketplace/domain/dependencies.ts";

void ({ name: "helper" } satisfies DeclaredDependency);
// @ts-expect-error A declared dependency always carries a name.
void ({ version: "^1.0.0" } satisfies DeclaredDependency);

describe("isRenderableDependencyToken", () => {
  for (const { label, candidate, expected } of [
    { label: "a token opening with a hyphen", candidate: "-leading-hyphen", expected: false },
    // ...
  ]) {
    test(`${label} is ${expected ? "" : "not "}a renderable dependency token`, () => {
      // arrange
      // act
      // assert
```
Copy three things: the explicit `.ts` import with the type inline, the compile-time shape proofs with `satisfies` and `@ts-expect-error`, and the table loop with `// arrange`, `// act`, `// assert`. Read `.agents/skills/typescript-unit-tests/SKILL.md` before writing cases. The pair needs 100% direct coverage (`npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/user-config.ts`).

### `E/domain/components/plugin.ts` and `E/domain/unsupported-components.ts`

`plugin.ts:36-46` holds `userConfig: Type.Optional(Type.Unknown())` inside `UNSUPPORTED_COMPONENT_FIELDS`, spread into both schemas. Keep the field `Type.Unknown()` (the `dependencies` precedent: the parser validates, not the schema) and move it out of that bag with a comment that cites D-PG10-04. `bin` already sits in the bag while being supported (D-90-06), so the bag is not the truth; the closed set is.

`unsupported-components.ts:38-49`: delete the `"userConfig"` member. Update the audit note at `:14-17` ("The last audit, on 2026-10-06, read the Claude Code 2.1.291 binary") to 2.1.323, and add a `userConfig` sentence in the style of the existing `bin` note:
```typescript
 * D-90-06: `bin` is intentionally absent. A plugin's `<pluginRoot>/bin` is
 * runtime-honored through the PENV-01 PATH ledger, so a bin-shipping plugin
 * installs by default at Claude Code parity.
```
`test/domain/unsupported-components.test.ts:105`, `:128` flip.

### `E/domain/plugin-resolver.ts` (two arms)

**Where the stage goes.** Structural stages return a dirty flag and are folded (`:828-859`):
```typescript
  flags.push(
    await collectStrictComponentPaths({ entry, manifest, pluginRoot, resolution: partial }, statKindOf(ctx)),
    await resolveStrictMcp({ entry, manifest, pluginRoot, resolution: partial }, { ... }),
    await resolveHooks({ pluginRoot, entry, manifest, resolution: partial }, { ... }),
  );

  return flags.includes(true);
```
The malformed `userConfig` arm is a fourth member here: push a note, return `true`. `decideResolution` (`:867-883`) then gives `unavailable`, and structural precedence holds without new code.

**The partial arm** copies `addUnsupportedKindNotes` (`:697-722`), which runs after the structural stages and never feeds `dirty`:
```typescript
  for (const kind of kinds) {
    partial.notes.push(`contains ${kind}`);
    partial.unsupported.push(kind);
    dirty = true;
  }
```
For a required option with no default: push one note with a fixed prefix and the keys, and one member of `partial.unsupported`.

**Entry or manifest** (D-PG10-05, U7.5). Copy `E/domain/mcp-resolution.ts:441`:
```typescript
input.manifest === null ? input.entry.mcpServers : input.manifest.mcpServers
```
Do not copy `declaresUnsupportedKind` (`unsupported-components.ts:126-129`), which counts the entry even when `plugin.json` exists.

**Carry the parsed schema on the resolution** as a required member of `MaterializablePlugin`, the way `declaredMcpServers` is carried (`install-outcome.ts:1669` reads `installCtx.resolved.declaredMcpServers`). A required member makes every writer a compile error until it is fed (RESEARCH Pattern 2).

### The new partial reason token (every closed-set home)

**Analog:** `unsupported mcp` (ANAME-07), the last unsupported-class token added.

| Home | Line | What `unsupported mcp` has there |
|---|---|---|
| `E/shared/notification-types.ts` `Reason` | `:236-242` | a member with a comment that says why it is a typed kind and where the per-item breakdown rides |
| `E/shared/notify-reasons.ts` `UnsupportedReason` | `:117-133` | tail member with a one-line ID comment; a compile-time partition proof follows |
| `E/shared/probe-classifiers.ts` local `UnsupportedReason` | `:76-77` | member of the union the classifiers return |
| `E/shared/probe-classifiers.ts` `kindToReason` | `:237-251` | `if (kind === "mcpServers") { return "unsupported mcp"; }` |
| `E/shared/notification-wire.ts` | `:151` | `"unsupported mcp": true,` in the reason map |
| `E/orchestrators/plugin/install.messaging.ts` `classifyResolverReason` | `:545-606` | mirrors `classifyResolverNote` arm for arm |
| `test/architecture/notify-closed-set-locks.test.ts` | `:108`, `:223` | map member; "Reason is the closed 80-entry reason set" becomes 81 |
| `test/architecture/compat-01-no-expansion.test.ts` | `:293`, `:395` | member in order |
| `test/architecture/cross-surface-reason-parity.test.ts` | `:164-165` | install and list/info give the same reasons |
| `test/architecture/catalog-uat/fixtures/plugin-{install,list,info}.ts` | `install:338`, `list:708`, `info:525` | one fixture row per surface |
| `docs/output-catalog.md` | `:63`, `:147`, `:732-736`, `:3416` | grammar paragraph, status table row, catalog block, classifier sentence |
| `docs/json-output.md` | `:950` | the `Reason` list, appended |

**Member comment to copy** (`notification-types.ts:236-242`):
```typescript
  // ANAME-07: a server of the plugin uses a Claude Code MCP feature
  // pi-mcp-adapter cannot honor, so `--partial` leaves that server out whole.
  // A typed kind, not a note, as `unsupported hooks` is: the aggregate token
  // rides the row, and each server with its blocking feature rides the info
  // breakdown.
  | "unsupported mcp"
```
The header of `Reason` says a new token appends at the tail of the catalog order; check where "tail" is before inserting, because later members follow `unsupported mcp` today.

**Shared note prefix.** A token cannot hold a key. Export the note prefix as a constant and match it with `startsWith` in both classifiers, the way `SOURCE_DIR_MISSING_NOTE` works (`probe-classifiers.ts:122-127`, used at `:171` and `install.messaging.ts:589`):
```typescript
/**
 * SRC-01: the prefix of `domain/plugin-resolver.ts`'s note for a plugin
 * directory that does not exist. Install's resolver-reason classifier matches
 * the same prefix, so both surfaces read `source missing`.
 */
export const SOURCE_DIR_MISSING_NOTE = "source dir does not exist";
```
Arm order is load-bearing. `classifyResolverNote` (`:147-184`) runs prefix arms before `note.includes("lspServers")`, and `classifyResolverReason` runs them before `reason.includes("source")`. An option key is author text, so the new arm goes before both substring arms (the WR-01 comment at `:157-164` states the rule). `domain/` cannot import `shared/probe-classifiers.ts` constants? It can: `domain` imports `shared` only, and `plugin-resolver.ts` already writes the notes those constants name. Confirm the import direction with `fallow guard` before choosing where the constant lives.

**The malformed arm** needs a reason too. The precedent is `malformed mcp` (`notify-reasons.ts:151-157`, a `FailureReason`, "a malformation of a SUPPORTED feature the resolver parses"), split per kind as `malformed skill` and `malformed command` were (`:158-163`). Reusing an existing failure token (for example `invalid manifest`) adds no vocabulary member; a new `malformed ...` token is a second member through the same homes. This is the agent's discretion under CONTEXT; state the choice in the plan.

### `E/persistence/state-io.ts` (record field `userConfig`)

**Analog:** `mcpServerConfigs` (`:143-156`):
```typescript
  // MREC-01 / D-MB-04: every declared, non-malformed MCP server of the
  // version this record names, in D-CF6-01 merge order, each as the plugin
  // declared it, before plugin-variable substitution, the servers the adapter
  // blocks included. OPTIONAL and additive -- NO schemaVersion bump (the
  // resolvedSha precedent), so a legacy record without it loads unchanged and
  // absence needs no migrate fill.
  //
  // ABSENCE MEANS "this record predates the key", never "no servers": the
  // reader re-resolves the declaration read-only. A present empty array means
  // the plugin declares no non-malformed server. A value never holds a
  // substituted variable, an environment value, or an absolute host path.
  mcpServerConfigs: Type.Optional(
    Type.Array(Type.Object({ name: Type.String(), config: Type.Unknown() })),
  ),
```
Write the same three-part comment: the ID (D-PG10-23), "OPTIONAL and additive -- NO schemaVersion bump", and what absence means ("this record predates the key", so no options are exported until a restage, D-PG10-15). Say that it holds the declared schema and no value the user typed (D-PG10-14).

**Producer helper** (`:294-307`):
```typescript
export function mcpServerConfigsOf(
  declared: Readonly<Record<string, unknown>>,
): NonNullable<PluginInstallRecord["mcpServerConfigs"]> {
  return Object.entries(declared).map(([name, config]) => ({
    name,
    config: structuredClone(config),
  }));
}
```
Give `userConfig` one such helper, so all writers call one function and store a deep copy.

**Writers** (finding 1):
- `E/orchestrators/plugin/install-outcome.ts:1664-1669` (`statePhase`): `mcpServerConfigs: mcpServerConfigsOf(installCtx.resolved.declaredMcpServers),` with its comment.
- `E/orchestrators/plugin/update-swap.ts:953-956`: `sRecord.mcpServerConfigs = mcpServerConfigsOf(installable.declaredMcpServers);`, written "beside `compatibility` so a failed update keeps the previous servers next to the intent mark".
- `E/orchestrators/plugin/update-preflight.ts:798-807`:
  ```typescript
  export const DISABLED_PIN_FIELDS = [
    "version", "resolvedSource", "resolvedSha", "resolvedVersion",
    "compatibility", "compatibilityBasis", "mcpServerConfigs", "mcpBundle",
  ] as const satisfies readonly (keyof PluginStateRecord)[];
  ```
  plus `disabledPinProjection` (`:811-825`), `nextDisabledPin` (`:827-864`), and the write at `:927`.
- `E/orchestrators/reconcile/mcp-migration.ts:579` (`record.mcpServerConfigs = servers;`): check whether the AMIG-01 move holds a resolution with options when it backfills.

**Reader.** `E/orchestrators/mcp/recorded-servers.ts:101-114` is "the one reader" of `mcpServerConfigs` (`if (record.mcpServerConfigs === undefined) { ...legacy... }`). Give `userConfig` one reader too. It re-validates with the `domain/user-config.ts` parser (a project record is a file a repository can commit); an invalid stored value reads as no options and is debug-logged. Unlike `mcpServerConfigs`, an absent `userConfig` has no legacy re-resolve: it reads as no options.

### `E/shared/vars.ts` and the content stagers

**Analog:** the function itself (`:26-31`, `:37-49`, `:68-73`):
```typescript
export interface ClaudePluginVars {
  readonly pluginRoot: string;
  readonly pluginData: string;
  readonly skillDir?: string | undefined;
  readonly projectDir?: string | undefined;
}
// ...
export function substituteClaudeVars(content: string, vars: ClaudePluginVars): string {
  return content.replaceAll(CLAUDE_VAR_PATTERN, (matched, name: keyof typeof TOKEN_TO_FIELD) => {
    const value = vars[TOKEN_TO_FIELD[name]];
    return value ?? matched;
  });
}
```
Keep the three properties its doc comment states (`:57-66`): one pass, a spliced value is never scanned again, an absent value keeps the literal. The option reference joins the same alternation, so a path value that holds `${user_config.x}` text is not filled. Per reference: sensitive key gives `[sensitive option 'KEY' not available in skill content]` (checked first, value or not); no value keeps the literal; otherwise the text.

Finding 3 applies: declare the option input type in `shared/vars.ts`. `skillDir` and `projectDir` are optional members there, which is the class of bug RESEARCH Pitfall 2 warns about. Make the option member required on `ClaudePluginVars`, or required on each stager's context type, and let callers with no options pass an explicit empty value. `planSpawn` also calls `substituteClaudeVars` (`spawn-helpers.ts:52-57`) and needs the throwing behavior, not the literal one, so the hook fill is a separate function (below), not a flag on this one.

Call sites: `E/bridges/skills/stage.ts:148`, `:396`, context at `:507`; `E/bridges/commands/staged-command.ts:271`, context at `E/bridges/commands/stage.ts:188`; `E/bridges/agents/convert.ts:1016`; `E/bridges/agents/skill-preload.ts:90`. A plugin that declares no `userConfig` gets no option pass (D-PG10-21).

### `E/bridges/hooks/` (env, exec fill, refusal)

**Env** (`hook-env.ts:85-95`):
```typescript
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_PROJECT_DIR: vars.projectDir,
    CLAUDE_PLUGIN_ROOT: vars.pluginRoot,
    CLAUDE_PLUGIN_DATA: vars.pluginData,
    ...extra,
    // D-91-02: the session env spreads LAST so the authoritative per-dispatch
    // snapshot wins over both the live `process.env` and any per-lane `extra`.
    ...claudeSessionEnvFor(transCtx.sessionId),
  };
```
Spread the `CLAUDE_PLUGIN_OPTION_<KEY>` variables after the three path variables and before `...extra`. Both lanes call this one function (`dispatch-exec.ts:223`, `async-rewake/registry.ts:856`), so no lane needs its own code.

**Exec fill** (`spawn-helpers.ts:52-57`):
```typescript
  if (Array.isArray(argsField)) {
    const args: string[] = (argsField as readonly unknown[]).map((a): string =>
      typeof a === "string" ? substituteClaudeVars(a, vars) : JSON.stringify(a),
    );
    return { command: substituteClaudeVars(command, vars), args, shell: false };
  }
```
Add the option fill after the path fill on `command` and each string `args` element. It throws for a key with no value, for every plugin (D-PG10-21). The shell-form arm below it throws when the command names `${user_config.`. Both throws are typed error classes in `E/shared/errors-bridges.ts` (CONVENTIONS: `extends Error`, `this.name`, readonly fields, a doc comment with the ID), carrying upstream's text from RESEARCH E3 and E4. The existing start-failure path at `dispatch-exec.ts:223-246` already turns a throw before the spawn into the hook's `stderr` and a `failure: { kind: "run" }` result, so no new result kind is needed. Rewrite the comment at `spawn-helpers.ts:38-46`.

**Carrier** (`routing-state.ts:90-110`, producers `event-router.ts:218-225` and `:779-786`):
```typescript
  routingState.setParsedConfig(cacheKey(scope, marketplace, pluginId), {
    scope,
    marketplace,
    pluginId,
    resolvedSource: branded,
    config: result.value,
    ifPredicates: result.ifPredicates,
  });
```
Add the resolved options as a required member of `CacheEntry` and of `RoutingEntry`. The hydrate producer (`:779`) has only the record, so it reads the record's `userConfig` through the one reader; the install-time producer (`:218`) has the resolution.

**Existing pins that change** (D-PG10-21): `features/hook/process.feature:15` and `:25` (drop `"${user_config.token}"` from the path-variable row), `test/bridges/hooks/spawn-helpers.test.ts:41-57`, `test/bridges/hooks/dispatch-exec.test.ts:1797-1822`.

### `E/domain/claude-mcp-variables.ts` and `E/bridges/mcp/`

**Analog:** the walk (`:222-246`) and its result (`:80-84`):
```typescript
export interface ExpandedValue {
  readonly segments: readonly Segment[];
  readonly missing: readonly string[];
  readonly withheld: readonly WithheldReference[];
}
// ...
export function expandClaudeValue(raw, fieldClass, env, builtins): ExpandedValue {
  const expanded = replaceBuiltins(raw, builtins);
  const segments: Segment[] = [];
  const state: ScanState = { fieldClass, env, builtins, missing: [], withheld: [] };
  let textStart = 0;
  for (const match of expanded.matchAll(CLAUDE_VARIABLE)) {
```
Add `unsetOptions: readonly string[]` beside `missing`, and the option pass between `replaceBuiltins` and the `CLAUDE_VARIABLE` scan, in its own small function (two complexity gates; do not grow `segmentFor`, `:174`). Emit `{ kind: "ref", name }` for the adapter and `{ kind: "text", text }` for built-in, directly, never through `segmentFor` (it would report the name missing and test it against the deny-list). The option data joins `ClaudeBuiltins` (`:56-60`) or a sibling parameter as a required member; `projectDir: string | undefined` there is the model for "required key, possibly absent value". `test/domain/claude-mcp-variables.test.ts:328` flips.

Callers to feed (RESEARCH Pattern 2): `prepareStageMcpServers` at `E/orchestrators/plugin/install-outcome.ts:1474`, `update-swap.ts:433`, `reconcile/mcp-migration.ts:489`; the built-in context at `E/orchestrators/mcp/builtin-registration-step.ts:247-252`. The stage overlays the escaped option variables on its environment (`{ ...input.env, ...optionEnv }`) so `resolvedUrl` (`adapter-entry.ts:291-305`) and `isCleanHeaderValue` (`:139-150`) decide with them. Escape through `serializeLiteral(value, false)` in `E/bridges/mcp/adapter-escape.ts`; do not write a second escaper.

### The MCP drop notice (D-PG10-21) vs `ca-file-removed`

**Analog chain, one stop per home:**

1. Type (`E/shared/notification-types.ts:1402-1425`), added to the `McpConfigNotice` union (`:1431-1439`):
   ```typescript
   /**
    * D-PG9-14: a stage left the user's `caFile` out of a plugin server's entry,
    * or a stage or unstage removed an entry with the user's `caFile`.
    */
   export interface McpCaFileRemovedNotice {
     readonly kind: "ca-file-removed";
     readonly scope: Scope;
     readonly file: "mcp-adapter.json";
     readonly plugin: string;
     readonly server: string;
     readonly reason: McpCaFileRemovedReason;
   }
   ```
2. Summary line (`E/shared/notification-mcp.ts:33-42`), a `satisfies Record<McpConfigNoticeSection, string>` map, so a missing member fails typecheck: `"ca-file-removed": "MCP server caFile removed.",`
3. Line renderer (`:117-119`) and the `switch` arm (`:141-142`). Names from plugin files go through `printable(...)`.
4. Wire schema (`E/shared/notification-wire.ts:767-779`): `Type.Object({ kind: Type.Literal("ca-file-removed"), ...MCP_NOTICE_SUBJECT_FIELDS, reason: ... }, { additionalProperties: false })`. The `variables-missing` member beside it uses `names: STRINGS`.
5. Section order (`E/shared/notification-resolve.ts:757-766` `MCP_CONFIG_NOTICE_SECTIONS`), redaction arm (`:850-856`), and severity (`isWarningNotice`, `:999-1006`).
6. JSON projection (`E/shared/notification-json.ts:278-283`): `case "variables-missing": case "credentials-blanked": return { kind: notice.kind, ...wireNoticeSubject(notice), names: [...notice.names] };`. A new kind with `names` joins this arm with no new code.
7. Producer in the stage (`E/bridges/mcp/stage.ts:250-263`) and its place in the notice list (`:608-632`, with the ordering comment at `:602-611`):
   ```typescript
   /** D-PG9-14: one notice per server whose entry leaves out the user's `caFile`, with why. */
   function caFileRemovedNotices(
     removals: ReadonlyArray<Pick<McpCaFileRemovedNotice, "server" | "reason">>,
     scope: Scope,
     pluginName: string,
   ): McpCaFileRemovedNotice[] {
     return removals.map(({ server, reason }) => ({
       kind: "ca-file-removed", scope, file: "mcp-adapter.json", plugin: pluginName, server, reason,
     }));
   }
   ```
   The data comes up from `stampServers` (`E/bridges/mcp/adapter-entry.ts:524-577`, which returns `{ stamped, warnings, variableReports, caFileRemoved }`).
8. Unstage fold (`E/orchestrators/marketplace/shared.ts:489-513`): the filter that drops notices of removed servers lists each server-subject kind by name. Add the new kind.
9. Tests and docs: `test/architecture/mcp-config-notices.test.ts` (locks the bytes against the catalog block), `test/shared/notification-{mcp,resolve,json}.test.ts`, `test/bridges/mcp/stage.test.ts`, `docs/output-catalog.md`, `docs/json-output.md`, and the scenario precedent in `features/mcp-server/lifecycle.feature`.

Confirm that a dropped server is left out of `resources.mcpServers` (RESEARCH open question 2), and settle finding 4 for the built-in arm.

### `E/shared/session-env.ts` (owned-variable ledger core)

**Analog:** the PATH ledger.

Constant with its doc comment (`:65-73`):
```typescript
/**
 * PENV-01 / D-90-01: the pi-only bookkeeping env var that records the exact
 * list of PATH entries this extension appended (name mirrors the
 * `PI_CLAUDE_MARKETPLACE_DEBUG` convention). It survives `/reload` together
 * with `process.env` and dies with the process -- which is precisely why it
 * replaces a module-level baseline (module top-level is wiped on `/reload`).
 * It is visible to child processes; a documented pi-only bookkeeping var.
 */
export const PATH_LEDGER_ENV = "PI_CLAUDE_MARKETPLACE_PATH";
```
Add `PI_CLAUDE_MARKETPLACE_OPTIONS` and the name prefix `PI_CLAUDE_MARKETPLACE_OPTION_` the same way (D-PG10-23).

Pure core with a read-side filter (`:159-177`):
```typescript
export function applyPathLedger(
  currentPath: string,
  priorLedger: string,
  freshBinDirs: string[],
): { path: string; ledger: string } {
  // The ledger only ever records absolute, non-empty bin dirs (write-side
  // invariant). Re-enforce it on read: drop empties AND relative entries, so a
  // tampered/corrupted ledger cannot make the removal step strip a non-owned
  // relative or empty PATH segment (the ledger's only power is removal).
  const owned = new Set(
    priorLedger.split(path.delimiter).filter((entry) => path.isAbsolute(entry)),
  );
```
The option ledger core is pure in the same way: prior ledger text and fresh name-value pairs in; names to delete, pairs to set, and new ledger text out. On read it keeps only entries that start with the owned prefix. The module header (`:6-22`) lists "Three disjoint concerns on disjoint key sets"; make it four. The module stays free of `fs` and of imports outside `platform/`.

For the `process.env` mutation style, copy `applyMcpAdapterEnv` (`:118-135`): `Reflect.deleteProperty(process.env, name)` to remove, plain assignment to set, and a boolean or small result so the caller logs (this module does not log). Correct the comment at `:144-148` ("Adds a dir even if it does not exist on disk (no fs stat; Claude Code parity)") per D-PG10-03.

Tests: `test/shared/session-env.test.ts:339-429` (`describe("applyPathLedger")`: "removes owned entries and appends fresh entries in stable order", "is byte-idempotent across repeated recomputes") and `:163-177` (the exact-key tests for each constant).

### `E/orchestrators/plugin-options.ts` + test (NEW pair)

**Analog:** `E/orchestrators/plugin-path.ts`, whole file (116 lines).

Header (`:1-10`), which states why the shell is not in `shared/`:
```typescript
/**
 * orchestrators/plugin-path.ts -- the PENV-01 plugin-PATH recompute I/O shell.
 *
 * Reads install state for both scopes and threads it through the pure ledger
 * core in `shared/session-env.ts` into `process.env.PATH` +
 * `PI_CLAUDE_MARKETPLACE_PATH`. Lives in `orchestrators/` (not `shared/`)
 * because it imports `persistence/` -- the D-v1.0-01-11 import-direction rule forbids
 * `shared/` from importing `persistence/`, ...
 */
```
Imports (`:11-21`): `homedir`, `locationsFor`, `isRecordedButDisabled`, `loadState`, `hookDebugLog`, `errorMessage`, the ledger core, and `import type { ExtensionState }` last.

Record walk (`:35-62`): iterate `Object.entries(state.marketplaces)` then `Object.entries(mp.plugins)`, skip with `isRecordedButDisabled(rec)` (ENBL-05, never the `enabled` boolean), debug-log a dropped record with `hookDebugLog(..., "env")`.

Per-scope isolation (`:95-106`):
```typescript
  const scopeRoots = [
    { scope: "user", extensionRoot: locationsFor("user", homedir()).extensionRoot },
    { scope: "project", extensionRoot: locationsFor("project", cwd).extensionRoot },
  ] as const;
  for (const { scope, extensionRoot } of scopeRoots) {
    try {
      // eslint-disable-next-line no-await-in-loop -- two scopes, one state read each
      freshBinDirs.push(...collectBinDirs(await loadState(extensionRoot)));
    } catch (err) {
      skipped.push({ scope, reason: errorMessage(err) });
    }
  }
```
Two deliberate differences from the analog. Read with `loadState(extensionRoot, { persistMigration: false })`, as `E/orchestrators/mcp/builtin-registration-step.ts:89` does, because the factory must not write. On a failed state read keep that scope's owned names (RESEARCH "If a scope's state cannot be read"); the PATH shell removes them. The project scope is read only when the trust answer is true, and its names are removed when it is false (D-PG10-23).

This module must stay outside `NETWORK_SEAMS` (ESLint BLOCK F): no `platform/git` import, no `gitOps` identifier.

Test analog: `test/orchestrators/plugin-path.test.ts:1-60` (fixture builders `pluginRecord`, `marketplaceRecord`, `stateFor`) and `:118-150`:
```typescript
describe("recomputePluginPath", () => {
  test("applies enabled bins in marketplace and plugin insertion order", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-order-");
    // ...
    try {
      process.env.PATH = baseline;
      delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
      await seedState(path.join(projectRoot, ".pi", "pi-claude-marketplace"), state);

      // act
      const pathUpdate = await recomputePluginPath(projectRoot);
```
Copy `createHermeticEnvironment(t, ...)` from `test/platform/hermetic-environment.ts`, the env snapshot and `try`/`finally` restore, and `seedState`. The two test files will share fixture builders; fallow dupes fails on any clone group, so move the shared builders into one `test/` support module or import them, do not copy.

### `E/orchestrators/plugin-path.ts` (trust input, stat filter)

Signature today (`:87-89`): `export async function recomputePluginPath(cwd: string): Promise<{ skipped: SkippedPathScope[] }>`. Add `projectTrusted: boolean` as a required parameter. When false, leave the project entry out of `scopeRoots` so its `state.json` is not read; `applyPathLedger` then removes its earlier entries with no extra code. Keep the early return at `:108-110`.

Put the stat filter here, never in `shared/session-env.ts`. Shape from RESEARCH "PATH filter, shape only" (upstream's character class verbatim, skipped when `path.sep` is `\`, `ENOENT` and `ENOTDIR` drop, any other stat error keeps). Log each drop and each kept-despite-error in the style of `:53-56`:
```typescript
        hookDebugLog(
          `plugin PATH: dropped invalid resolvedSource for ${mpName}/${pluginName}: ${errorMessage(err)}`,
          "env",
        );
```
`collectBinDirs` is documented "Pure: reads no `process.env`, touches no fs" (`:24-27`). Keep it pure and filter its output in an async step. Update the doc comments at `:23-33` and `:70-86`.

Test fixtures change: every case in `test/orchestrators/plugin-path.test.ts` builds records such as `pluginRecord("/plugins/second", true)` with no directory on disk (`:128-133`). Each needs a real `bin` directory under the hermetic root (the file already imports `mkdir`, `writeFile`) or a new expectation. Same for the PATH cases of `test/index.test.ts` (`:1109-1178`, and those RESEARCH lists through `:2333`).

### `E/index.ts`

Trust constant and its consumers (`:160-179`):
```typescript
    // D-LOC-01: an untrusted project's hooks are not routed, and a load with
    // autoapply on does not apply its scope.
    const projectTrusted = ctx.isProjectTrusted();
    try {
      await hooksHydration.hydrateProjectScopeForCwd(event.cwd, projectTrusted);
    // ...
      await loadReconcile({ ctx, run, cwd: event.cwd, projectTrusted, hooksRouting, completionCache });
```
The one call to change (`:199`): `const pathResult = await recomputePluginPath(event.cwd);` becomes the two-argument form with the same constant. Do not call `ctx.isProjectTrusted()` again (finding 6). Extend the comment at `:160-161` with `PATH`.

Factory-time variable set (`:88-91`) and the wrapper to copy for the option variables (`:56-67`):
```typescript
function applyMcpAdapterEnvFrom(readCwd: () => string): void {
  try {
    if (!applyMcpAdapterEnv(readCwd)) {
      hookDebugLog("CLAUDE_PROJECT_DIR removed: ...", "env");
    }
  } catch (err) {
    hookDebugLog(`MCP adapter env apply skipped: ${errorMessage(err)}`, "env");
  }
}
```
A throw never escapes the factory, `resources_discover`, or `session_start` (NFR-2). The factory is `async` and awaited, so the user-scope option variables can be set there with an `await`. Each stage in `prepareResources` has its own `try`/`catch` with a `hookDebugLog` (`:190-205` shows the form); the project-scope set is one more such stage. Add the two new names to the env snapshot list at `test/index.test.ts:304-305`.

### `E/orchestrators/skill-invocation.ts:151` and `command-invocation.ts:164-166`

The whole change is removing two conditions:
```typescript
    ...(skill.projectScope ? { CLAUDE_PROJECT_DIR: request.cwd } : {}),
```
```typescript
  if (command.scope === "project") {
    variables.CLAUDE_PROJECT_DIR = request.cwd;
  }
```
After the change, check whether `skill.projectScope` and `command.scope` still have a reader; remove only what this change orphans (AGENTS.md "Surgical Changes"). Unit pins that flip: `test/orchestrators/command-invocation.test.ts:133`, `:226`; `test/orchestrators/skill-invocation.test.ts:281` (the project half), `:642`. Pins that stay: `test/bridges/skills/stage.test.ts:1464`, `test/bridges/agents/stage.test.ts:593`. Correct the note at `E/domain/argument-substitution.ts:11-19` (D-PG10-13, Pitfall 12).

### `E/shared/completion-cache.ts`

Three literals: `:92` `schemaVersion: Type.Literal(7),`, `:331` and `:350` `schemaVersion: 7 as const,`. The header block at `:60-70` records each bump with its reason ("drop+rebuild on schemaVersion mismatch"); append the 7 to 8 line with D-PG10-24 and the rule change (a plugin whose options all have defaults is now `available`). `test/shared/completion-cache.test.ts` pins `"schemaVersion": 7` in five places. ARCHITECTURE.md's "`schemaVersion` 7" sentence is a codebase map, not a record this phase must edit.

### Harness: the "Do not trust" profile

**Analog:** `features/support/world.ts:980-986`:
```typescript
  // Writes the `trust.json` entry Pi saves when a user trusts the sandbox
  // project, in Pi's format: sorted keys, two-space JSON, and a trailing
  // newline. Pi keys the entry by the project's realpath (D-CF1-07).
  private async trustSandboxProject(): Promise<void> {
    const { sandbox } = currentRun();
    const file = path.join(sandbox.agentDir, "trust.json");
    const text = `${JSON.stringify({ [await realpath(sandbox.cwd)]: true }, null, 2)}\n`;
    await writeFile(file, text, { flag: "wx" });
    assert.strictEqual(await readFile(file, "utf8"), text);
  }
```
The profile type (`:141-144`): `readonly trust?: "trusted" | "untrusted";`. The gate (`:690-692`): `if (profile.trust !== "untrusted") { await this.trustSandboxProject(); }`.

Add a third value (for example `"refused"`) and make the writer take the decision, so one function writes `true` or `false` (one helper, no clone). Update the `PiProfile` doc comment (`:134-140`).

**Step analog:** `features/step_definitions/model.steps.ts:65-82`:
```typescript
// Pi loads every extension twice in a project that needs a trust decision,
// once to ask the extensions and once with the decision, so this start gets
// two trusted starts' budget.
const UNTRUSTED_START_TIMEOUT_MS = 2 * PROFILE_PI_START_TIMEOUT_MS;

// D-CF1-07: the profile Pi starts with no entry in Pi's trust store. With a pi
// settings file in the project, that alone makes Pi distrust the project.
Given(
  "pi runs with the scripted model in an untrusted project",
  { timeout: UNTRUSTED_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await this.usePiWithProfile({ companions: [], trust: "untrusted" });
    await assert.rejects(access(path.join(this.tokens.agentDir, "trust.json")), {
      code: "ENOENT",
    });
  },
);
```
The new step is a sibling in the same module (the shared `model` module, a foundation file), with step text that names the saved decision and a read-back assertion that `trust.json` holds `false` for the realpath. A step with a `Given` proves its own effect (`.agents/skills/cucumber/rules/steps.md`). The new scenario uses no `Given the project holds a pi settings file`: it proves the gate in a folder that holds only this extension's files. Whether that start needs the doubled timeout is unmeasured; `features/lib/pi-process.ts:141`, `:196`, `:267` (`trustDecided`) is where the harness tracks a decision.

Both files are foundation files (`layout.md:54`, `:139`). Land them first, in a plan of their own. `features/support/world.ts` is a build input, so the commit runs `check:commit`.

### Harness: the executable-file publishing step

**Step analog:** `features/step_definitions/plugin/publishing.steps.ts:325-338`:
```typescript
// Writes any file of a published plugin by its path, replacing one that
// exists, such as the plugin's own `.claude-plugin/plugin.json`.
Given(
  "the published plugin {string} of the marketplace {string} has the file {string} with this text:",
  async function (this: ScenarioWorld, plugin: string, name: string, file: string, text: string) {
    const published = this.requirePublished(name);
    await writePublishedPluginFiles(published, plugin, { [file]: text });
    assert.strictEqual(
      await readFile(path.join(published.root, "plugins", plugin, file), "utf8"),
      text,
    );
  },
);
```
**Mode analog:** `features/lib/hook-files.ts:512-533` (`publishRecordingHooks`):
```typescript
  if (scripts.length > 0 && published.kind !== "dir" && published.kind !== "file") {
    throw new Error(`script hooks need a dir or file publication, not ${published.kind}`);
  }

  await writePublishedPluginFiles(published, plugin, { ... });
  const directory = path.join(published.root, "plugins", plugin);
  await Promise.all(
    scripts.map(async ([file, text]) => {
      const target = path.join(directory, file);
      await chmod(target, 0o755);
      if ((await readFile(target, "utf8")) !== text) {
        throw new Error(`the hook script ${file} does not hold the text written`);
      }
    }),
  );
```
`writePublishedPluginFiles` (`features/lib/published-marketplace.ts:719-730`) writes mode 0644 and goes through `changePublication`. The new step writes through it, then `chmod(target, 0o755)`, refuses a git publication as the analog does (a chmod after the commit is not in the clone), and asserts both the text and `(await stat(target)).mode & 0o777` (the assertion style at `publishing.steps.ts:309`). Step text names the function, for example `the published plugin {string} of the marketplace {string} has the executable file {string} with this text:`. A plugin-relative path such as `bin/hello` creates `bin/` through the writer's `mkdir`.

This step also serves a second need: `features/plugin/options.feature` writes `.claude-plugin/plugin.json` with `userConfig` through the existing generic file step, with no new step.

### `features/plugin/options.feature` (NEW)

**Analog:** `features/plugin/partial-install.feature:1-48`. Header form: `Feature: Plugin partial install`, then a three-line description that ends by naming the stand-ins. The file name must match the title: `Feature: Plugin options` is `features/plugin/options.feature`.

Refusal scenario shape (`:7-23`):
```gherkin
  Scenario: Installing a partially available plugin without --partial fails as partially available
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons               | hint            |
      | fixtures         | project           | demo@fixtures | demo | partially-available | unsupported component | partial-install |
    Then the project scope has no installed plugins
```
Replace the output-style `Given` with the generic file step writing `.claude-plugin/plugin.json`, and the `reasons` cell with the new token. The `--partial` scenario copies `:25-48` (status `partially-installed`, the installation record, the declared plugins). The all-defaults scenario expects status `installed` with an empty `reasons` cell. Use the full option shape in every fixture (D-PG10-20): `{"mode": {"type": "string", "title": "Mode", "description": "The mode.", "default": "fast"}}`. Add one scenario where the abbreviated shape gives `unavailable` (RESEARCH Pitfall 1). No scenario here names `mcp`, so none carries an implementation tag. No title may call the hook or content default "parity" or "as Claude Code" (D-PG10-19).

### `features/plugin/executables.feature` (NEW) and the new `project-trust.feature` scenario

**Analog:** `features/plugin/project-trust.feature:7-42`. Bash rows through the scripted model:
```gherkin
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the model receives these calls:
      | call | role        | text                                         |
      | 1    | user        | run the echo                                 |
      | 2    | user        | run the echo                                 |
      | 2    | assistant   | tool call bash {"command":"echo from-model"} |
      | 2    | tool result | bash returned: from-model\n                  |
```
Use commands whose output does not depend on shell error text (RESEARCH "Stand-ins"): `command -v hello || echo absent` for presence, `printf %s "$PI_CLAUDE_MARKETPLACE_PATH"` for "one plugin entry". Token expansion (`{home}`, `{project dir}`) works in table cells (`model.steps.ts:87`, `expandTokens`).

The "Do not trust" scenario cannot use this file's `Background` as is: the Background starts Pi with the untrusted profile and a pi settings file (`:8-9`), and one scenario starts at most one profile Pi (`world.ts:679-681`). Either the scenario lives in `executables.feature` beside the trusted one, or `project-trust.feature` moves the two profile steps out of its Background. RESEARCH assigned it to `project-trust.feature`; the planner picks, and the first option changes no existing scenario. "A trusted project's plugin executable is found" is a guard that passes on today's code; record it as a guard in VALIDATION.

### `features/mcp-server/options.feature` (NEW) + its step module

**Analog:** `features/mcp-server/configuration.feature` for scenarios, `features/mcp-server/resources.feature:1-8` for a file that mixes tags per scenario:
```gherkin
Feature: MCP server resources

  A plugin server's resources reach the model under each MCP implementation (PG-MCP-08, D-PG9-10).
  A stdio stub server with one text resource stands in for a real one, a scripted model for a real
  model, and a local marketplace for a published one.

  @adapter-only
  Scenario: The model reads a plugin server's resource through pi-mcp-adapter's resource tool (PG-MCP-08)
```
Tag rules (`.agents/skills/cucumber/rules/features.md:111-124`): every scenario in this file is an MCP scenario and carries exactly one implementation tag. `@mcp` when both implementations give the same result, and then no step, cell, or doc string names `pi-mcp-adapter`. `@adapter-only` and `@builtin-only` scenarios name an ID in the title: `(PG-CORE-03, D-PG10-11)` for "`mcp-adapter.json` holds a reference and no value", `(PG-CORE-03, D-PG10-12)` for "Pi's registry holds the value". A result that differs by implementation is a pair in one file. `npm run check:features` enforces all of it.

Steps to reuse, with their sites:
- stub with fields: `features/step_definitions/mcp-server/builtin-values.steps.ts:44-62` (`has the stub mcp server {string} with these fields:`; the entry is `{ command: process.execPath, args: [MCP_STUB_SERVER, plugin, server], ...fields }`).
- env echo: `features/step_definitions/mcp-server/configuration.steps.ts:181-198` (`that echoes its {string} and {string} environment variables`, through `STUB_TAG_FROM`).
- remote headers: the HTTP stand-in and `Then the http mcp server {string} receives these json-rpc requests:` (`configuration.steps.ts:291`), scenario pair at `configuration.feature:168-246`.
- env value reaching the stub, as a pair: `configuration.feature:486-540`.
- registry probe for the built-in value: `features/mcp-server/builtin-values.feature:19-24` (`pi runs with the scripted model and a probe of the mcp servers registered with pi's built-in mcp`, then `pi holds these mcp server configs, ...`).
- adapter file text: `Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:` (09-PATTERNS, `lifecycle.feature:393-454`). The reference in the pin is `${PI_CLAUDE_MARKETPLACE_OPTION_<16 hex>}`; compute the hex once and state it in the scenario, since it is a pure function of scope, marketplace, plugin, and key.

A new step goes in a new module `features/step_definitions/mcp-server/options.steps.ts`, with step text that names its topic (`layout.md:56`, `:88`), and writes fixtures through `features/lib/mcp-server-files.ts` (`layout.md:80`). Mind the stub-marker rule at `layout.md:80`: a wrapped `.mcp.json` whose only server is named `stub` cannot go through the stub-marker steps.

### `features/hook/process.feature` and `features/hook/failures.feature`

**Analog:** `process.feature:7-28`. The recorder keeps every `CLAUDE_*` variable, so `CLAUDE_PLUGIN_OPTION_MODE` is one more column of `Then the hooks record these runs:` (RESEARCH assumption A4: confirm the column mapping before relying on it). The exec scenario's `arguments` cell is a JSON array; add `"${user_config.mode}"` to a plugin that declares the option, and remove `"${user_config.token}"` from the existing row at `:15` and its expectation at `:25`. The unset-option failure and the shell-form refusal go in `failures.feature`, with upstream's message text from RESEARCH E3 and E4 (plugin named `<pluginId>@<marketplace>`).

### Records and docs

- **`.planning/PROJECT.md`**: row format of `:2396` (D-PG9-01):
  `| **D-PG9-01 (parity-gaps, Phase 9, settled by upstream parity in the autonomous discussion of 2026-11-14, pending maintainer review; PRD decision 5; amends ANAME-05): <title>**: <premise + versions>. | <reference> | -- Pending |`
  Append D-PG10-01, D-PG10-04, D-PG10-11, D-PG10-16 after `:2401`, each "pending maintainer review", with "amends SUB-02" in the D-PG10-16 title. Footer line in the form of `:2702`. Other edits by line are in RESEARCH "Records to correct" (`:745`, `:1707`, `:2150`, `:2203`).
- **`.planning/upstream/pi-extension-trust-paths.md`** (NEW): layout of `.planning/upstream/pi-mcp-adapter-per-server-sampling.md:1-10`:
  ```markdown
  # pi-mcp-adapter: no per-server switch to withhold sampling

  Patch: no patch exists; this report is not filed.
  Repository: https://github.com/nicobailon/pi-mcp-adapter
  Package version: 7.0.1, read as source, 2026-11-14.

  ## Problem: sampling is on for every server or for none
  ```
  Read the Pi repository URL from `node_modules/@earendil-works/pi-coding-agent/package.json`; do not guess it.
- **`.planning/BACKLOG.md`**: entry form of `:5329` (`## MCPSAMPLING-01: withhold sampling from plugin servers once pi-mcp-adapter has a per-server switch`), appended at the end. Amend `## USRCFG-01` at `:1387` in place.
- **`CHANGELOG.md`**: one sub-bullet under the milestone bullet at `:5`, in the voice of `:9-13` (what changed, then what the user does: "run `reinstall` once", and the one-time project server approval). Read `.agents/skills/changelog/SKILL.md` if it exists.
- **Docs**: lines per RESEARCH "Records to correct". `docs/mcp-compatibility.md:280` is the model paragraph for a new default with its precedence and restage paths (09-PATTERNS).

## Shared Patterns

- **Required carriers.** Every context type that feeds a stager, a hook entry, or the MCP walk gets the option data as a required member; callers with none pass an explicit empty value. Optional members compile at every forgotten site (memory "optional-field silent-omission class"; RESEARCH Pattern 2).
- **Own-key reads.** `Map`, `Object.entries`, or `Object.hasOwn` for every option map: `__proto__` and `constructor` are valid keys (`state-io.ts:294-307` states the rule for server names).
- **Decision-ID comments.** Comments and test titles cite `D-PG10-xx`, `PG-CORE-0x`, `PG-SEC-02`, never phase or plan numbers. No comment on trivial code.
- **Pure core in `shared/`, I/O shell in `orchestrators/`.** `shared/session-env.ts` plus `orchestrators/plugin-path.ts` is the split for both ledgers and for the stat filter.
- **NFR-2 boundary.** Every new stage in the factory, `resources_discover`, and `session_start` sits in its own `try`/`catch` with `hookDebugLog(..., "env")` (`index.ts:56-67`, `:190-205`).
- **Typed errors.** One class per failure mode in `E/shared/errors-bridges.ts`, `extends Error`, `this.name` set, readonly fields, narrowed with `instanceof`.
- **Complexity and duplication.** One small function per new pass (`expandClaudeValue`, `planSpawn`, `recomputePluginPath` are near both ceilings of 15). fallow dupes fails on any clone group: widen an existing helper or step instead of adding a sibling.
- **Hermetic tests.** Owner tests run under `test/platform/isolated-pi-home.ts` and `createHermeticEnvironment`; scenarios run in the cucumber world. Never touch the real `~/.pi/agent`. Tests that mutate `process.env` snapshot and restore it.
- **No parity claim for the default on hooks and content** in a doc, comment, scenario title, or test title (D-PG10-19).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| The "isn't set" drop for a server under Pi's built-in MCP (the notice or its absence) | notification | event-driven | Every server-subject MCP notice pins `file: "mcp-adapter.json"`, and the built-in path emits no per-server notice today. Use RESEARCH open question 2, option B, and settle the built-in wording in the plan. |

## Metadata

**Analog search scope:** `E/domain`, `E/domain/components`, `E/shared`, `E/persistence`, `E/orchestrators` (root, `plugin/`, `mcp/`, `reconcile/`, `marketplace/`), `E/bridges/{hooks,mcp}`, `E/index.ts`, `features/{plugin,mcp-server,hook}`, `features/step_definitions`, `features/lib`, `features/support`, `test/{domain,orchestrators,shared,architecture}`, `.planning/{upstream,PROJECT.md,BACKLOG.md}`, `CHANGELOG.md`, `.agents/skills/cucumber/rules`
**Files scanned:** ~45
**Pattern extraction date:** 2026-11-14
