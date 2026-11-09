# Phase 10: Model-Facing Tools - Research

**Researched:** 2026-11-08
**Domain:** the two read-only Pi LLM tools in `extensions/pi-claude-marketplace/edge/handlers/tools.ts`, driven end to end through the cucumber scripted model
**Confidence:** HIGH (every output text below was observed in a cucumber probe run against this worktree, before and after a temporary fix that was then restored byte for byte)

## Summary

Phase 10 has one product file (`edge/handlers/tools.ts`), its unit pair, and one feature file. Every expected behavior is this extension's own surface (D-02); there is no upstream contract to research and no new package. I ran two cucumber probes from the scratch dir against the full `list-filters.feature` fixture plus a second user-scope plugin: 13 and 14 tool calls in one prompt, through the scripted model. The probes give the exact text the model receives for every status and filter. They confirm all three product bugs CONTEXT.md names, and they show that the D-BG-1002/1003/1004 fix shape gives the expected text. That fix was applied temporarily, probed, and then restored (sha256 `61128bcd…` before and after; `git status --short` clean).

Three findings change the plan beyond CONTEXT.md. (1) **The D-BG-1004 fix creates a second "empty block" shape.** Today a block that the loader's filter empties prints `  (no plugins)`. After the fix, `{"unavailable":true}` loads the installed rows and the tool drops them, so the user marketplace prints a bare `Marketplace extras (user)` header. CONTEXT.md's specifics expect `(no plugins)` under a block "the filter empties". The planner must choose one shape; I recommend printing `  (no plugins)` whenever a block keeps no rows (see Open Question 1, Dubious Choices). (2) **The call table grows as the square of the model calls.** `the model receives these calls:` compares every message of every call of the turn, and each call repeats the conversation, so a turn with N tool calls has (N+1)² rows (probe: 14 calls → 196 rows, 15 → 225). The "changes nothing" scenario must therefore use few calls, each with combined parameters, over a small fixture. (3) **`Type.Object({})` accepts any argument.** Pi 1.5.0 accepts `{"scope":"user"}` and even `{"scope":"everywhere"}` on today's list tool and ignores them, so the TOOL-01 scope scenario and the invalid-scope list scenario both have natural red proofs.

**Primary recommendation:** Two sequential waves. Wave 1 changes `tools.ts` and its unit pair: an optional `scope` on the list tool, `isError: true` on not-found, forwarding `installed: true` when the unavailable bucket is asked, the reworded descriptions, and, if accepted, `(no plugins)` for every block that keeps no rows. Wave 2 writes `features/plugin/model-tools.feature` from the literals below. It gets its natural red proofs by putting the wave-1 base `tools.ts` back in the working tree for a run, and the rest from the planted mutations listed below. No verb step module is needed.

## Project Constraints (from CLAUDE.md / AGENTS.md and the child-session rules)

- Work only in `/home/acolomba/src/pi-claude-marketplace-behavioral-gaps-phase-10` on `features/behavioral-gaps-phase-10`; commit only there; never push; no `git stash`, rebase, amend, `--no-verify`; no `gsd-tools query commit`/`config-set`; plain single git commands; `git commit -q -F <file> -- <paths>` after `SKIP=npm-check pre-commit run --files <files>`.
- Owned files: `features/plugin/model-tools.feature`, `features/step_definitions/plugin/model-tools.steps.ts` (only if needed), `extensions/pi-claude-marketplace/edge/handlers/tools.ts`, `test/edge/handlers/tools.test.ts`, and the planning files of this phase. Everything else is frozen or a sibling's: a needed change there is a "parent line".
- An unowned feature file gets no new scenario. If a product fix changes its expected rows, change only those rows, in their own commit, and name the file. **No unowned feature file pins the changed behavior** (see "Files the change touches").
- Commit titles: Conventional Commits, 5-72 chars, no milestone/phase/plan IDs. End every message with the two attribution lines from the rules.
- Every scenario fails without the behavior its title names, and the SUMMARY records the red proof. The tool scenarios carry no `@mcp`/`@adapter-only`/`@builtin-only` tag (D-BG-04, D-BG-1007). Expected values are whole literals.
- Quality bar (NFR-6): `npm run check` is green, with 100% direct line, function, and branch coverage of `tools.ts` from its own test.
- TypeScript strict; `explicit-module-boundary-types`; `sonarjs/cognitive-complexity` 15 and fallow `maxCognitive` 15 / `maxCyclomatic` 20 (both must pass); `curly: all`; blank line after blocks; no nested conditionals.
- IL-2: tools never notify; output to the model goes only through the tool result. PMOD-04: every content string goes through `textContent` (credential redaction). TC-9: each `execute` catches into `loadFailure`.
- Comments cite durable IDs (D-BG-1004, PL-1, …), never phases, plans, or waves. Default to no comment on trivial code.
- Hermetic home: never run Pi or the extension against the real `~/.pi`. The npm test scripts and cucumber give a temporary home.
- Never pipe a gate into `tail`/`grep`/`head`. Redirect to a scratch file and read it.
- Every plan SUMMARY needs `## Threat Flags`, `## Dubious Choices`, and the last one a "Parent lines" list. Prefix WINDOWS descriptions with `[behavioral-gaps]`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Error results and the carried D-03 choice (D-BG-1001, D-BG-1003)

- **D-BG-1001 — both tools keep returning an `isError: true` result; neither throws.** json-output D-03 kept the TC-9 return shape and left "throw a redacted Error instead" to the user, because Pi 0.87.1 ignored a returned `isError`. Pi 1.5.0 honors it: `executePreparedToolCall` returns `isError: result.isError === true` (`node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js:588`), so a returned error result reaches the model as a failed tool result, with the redacted text (PMOD-04). Throwing would add nothing and would hand Pi an unredacted message path again. TOOL-03's scenarios pin the result the model receives under Pi 1.5.0 (a `failed:` row in the call log). The D-03 question closes with this answer, logged as a dubious choice for the user's review (P10-DC-01).
- **D-BG-1003 — an unknown marketplace is an error result.** Today `pi_claude_marketplace_plugin_list` with a `marketplace` that no visible scope records returns `Marketplace "<name>" not found.` as a SUCCESS result. TOOL-03 requires an error result, so the not-found result gains `isError: true`. The text stays `Marketplace "<name>" not found.` and `details.marketplaces` stays `[]`. The same applies when the marketplace exists only in the scope the call did not ask for (the existing `marketplaceExists` check already narrows by scope). The credential redaction of the name stays (PMOD-04).
- An unknown scope is refused by Pi's own argument validation before `execute` runs, against the TypeBox union `"user" | "project"`; the model receives Pi's validation failure as a failed result, which the scenarios read through Phase 1's projection `invalid arguments: <paths>` (P1-DC-11, P1-DC-62). The product adds no scope check of its own.

#### Marketplace list scope (D-BG-1002, D-BG-1005)

- **D-BG-1002 — `pi_claude_marketplace_list` gains an optional `scope` parameter.** Today its parameters are `{}`, so it cannot return "the scope it asks for" (TOOL-01). It takes the same optional `scope` union the plugin tool takes (`"user" | "project"`, same description wording adapted to marketplaces), and forwards it to `loadMarketplaceListEntries`, which already accepts `scope`. With no scope it returns both scopes, project first, as today. A scope with no marketplaces returns `No marketplaces configured.` (unchanged text, not an error: the scope is valid and simply empty). Content line shape is unchanged: `[<scope>] <name> -- <N> plugin(s) -- <source.logical>`.
- **D-BG-1005 — the list tool's `<N> plugin(s)` keeps counting the plugins installed from the marketplace (D-09).** The scenarios pin it with a marketplace that offers more plugins than are installed, so a counter of offered plugins and a counter of installed ones print different numbers. Phase 12 re-checks the picker's similar count (BROWSE-01, P1-DC-48), which is a separate surface; whether the two should agree is left to the user (P10-DC-03).

#### Plugin list statuses and filters (D-BG-1004)

- Each content line keeps the three-bucket projection (`[installed]`, `[available]`, `[unavailable]`, then the version, then the reasons in parentheses), with the existing folds: `upgradable`, `partially-installed`, and `partially-upgradable` read `[installed]`; `remote` reads `[available]` (RSTA-01); `partially-available` and `disabled` read `[unavailable]` (USTAT-02, D-54-01). The scenarios pin whole content texts, so a wrong fold fails them.
- **D-BG-1004 — each filter returns every plugin its tag names, and only those.** Today an installed-but-disabled plugin reads `[unavailable]` with no filter, but no single filter returns it: `installed: true` loads it and the tool's bucket re-filter drops it (it projects to the unavailable bucket), and `unavailable: true` never loads it (the loader's `--unavailable` admits the structural `unavailable` bucket only). Fix in `loadToolPluginPayload`: when the unavailable bucket is requested, also forward `installed: true` to the payload loader, so the disabled rows reach the tool's bucket re-filter, which keeps them under `unavailable` and still drops the installed-bucket rows the call did not ask for. The D-54-01 projection itself is kept (P10-DC-02 asks the user whether a disabled plugin should read `[installed]` instead). The `installed` and `unavailable` parameter descriptions are reworded so the model reads the same contract the tool applies: `installed` covers installed and enabled plugins; `unavailable` covers plugins this system cannot install and installed plugins that are disabled.
- The filters keep PL-1 union semantics: two filters return the plugins of either; no filter returns every plugin. The `marketplace` and `scope` parameters narrow the blocks as the slash command's `--marketplace` and `--scope` do.

#### Observation and scenario shape (D-BG-1006, D-BG-1007)

- **D-BG-1006 — "changes nothing" is observed on the files the user reads.** A scenario remembers the config and installation record bytes of both scopes (`claude-plugins.json`, `pi-claude-marketplace/state.json`, through the shared `config.steps.ts` steps), lets the model call both tools with each parameter form in one prompt, then checks both scopes' bytes are unchanged and the staged skills and prompts are those of the installed plugins. Its red proof plants a write in a tool body (for example a `saveState` of the loaded state) and shows the scenario fails; the SUMMARY records it.
- **D-BG-1007 — no implementation tag.** The tools have no MCP surface, and the fixtures declare no MCP server, so every scenario carries no `@mcp`/`@adapter-only`/`@builtin-only` tag and runs once, under the `adapter` profile (D-BG-04).
- Every expected value is a whole literal in the feature file: the whole call table of `the model receives these calls:`, with each tool result's whole text. The seeds may be rewritten (they use common steps only), but every step they use stays in use.
- The verb step module `features/step_definitions/plugin/model-tools.steps.ts` is created only if a scenario needs a step that the shared and topic modules lack. The expected scenarios need none (publishing, adding, installing, disabling, the scripted model, the call log, and the remembered bytes all have shared steps).

### Claude's Discretion

- The fixture marketplaces, plugin names, and how many statuses each scenario shows, as long as each of the three buckets, each of its folds the fixture can produce cheaply (installed, upgradable, partially-installed, disabled, available, remote, unavailable, partially-available), and both scopes are covered, and every scenario fails without the behavior its title names.
- Scenario Outline versus separate scenarios, and the plan and wave split (plans in one wave own disjoint files; this phase has one product file and one feature file, so a single wave or two sequential waves are both fine).
- The exact wording of the reworded parameter descriptions.

### Deferred Ideas (OUT OF SCOPE)

- A load failure (an unreadable `state.json`) reaching the model as `Failed to load <subject>: ...`, and a credential in a source URL redacted in the list tool's text (PMOD-04, TC-9). Both are existing, unit-tested behavior that TOOL-01..03 do not name; a later coverage pass may add them.
- Whether a disabled plugin should read `[installed]` in the tool (P10-DC-02) and whether the list tool and the picker should count the same plugins (P10-DC-03) wait for the user.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOOL-01 | A model calling `pi_claude_marketplace_list` gets the configured marketplaces of both scopes, or of the scope it asks for. | Probe A: today `{"scope":"user"}` returns both scopes (natural red). Probe B, with the fix: `{"scope":"user"}` → only `[user] extras …`, `{"scope":"project"}` → only `[project] tools …`, `{"scope":"everywhere"}` → `failed: invalid arguments: scope`. Literals in "Exact texts". |
| TOOL-02 | A model calling `pi_claude_marketplace_plugin_list` gets each plugin's compatibility and install status, filtered as it asks (installed, available, unavailable). | Probe A gives the whole unfiltered text with all 8 cheap statuses, and the three filter texts. The disabled bug is confirmed: `eps` is missing from both `installed` and `unavailable`. Probe B: with the fix, `unavailable` returns `eps` and nothing else new. |
| TOOL-03 | A call naming an unknown marketplace or scope gets an error result, and neither tool changes anything on disk. | Probe A: `{"marketplace":"ghost"}` and `{"marketplace":"extras","scope":"project"}` → `returned:` (natural red). Probe B → `failed: Marketplace "ghost" not found.` The invalid scope gives `failed: invalid arguments: scope` on both tools. Probe A: the bytes of both scopes stay the same after 13 calls, and the staged skills are `alpha-skill`, `delta-skill` (project) and `kilo-skill` (user). |
</phase_requirements>

## Architectural Responsibility Map

This is a Pi extension, not a web app, so the tiers are the extension's layers and the Pi host.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Argument validation (scope union, booleans) | Pi host (`pi-ai` `validateToolArguments`) | edge (`tools.ts` TypeBox schema) | Pi validates against the registered schema before `execute` runs. The product adds no check of its own (CONTEXT). |
| `isError` delivery to the model | Pi host (`pi-agent-core` `executePreparedToolCall`) | edge (`tools.ts` result shape) | Pi copies `result.isError === true` to the tool-result message. |
| Scope narrowing of marketplaces | orchestrators (`loadMarketplaceListEntries`) | edge forwards `scope` | The loader already takes `scope`. Only the tool lacks the parameter. |
| Plugin rows, statuses, PL-1 filtering | orchestrators (`loadPluginListPayload`/`shouldShow`) | edge (`projectRowStatus` + bucket re-filter) | The loader filters by fine status; the tool folds to 3 buckets and re-filters. The D-BG-1004 bug sits at the seam between the two. |
| Not-found detection | edge (`marketplaceExists` via `loadVisibleMarketplaces`) | — | Tool-local short-circuit. |
| Credential redaction (PMOD-04) | edge (`textContent`) | shared (`redactCredentials`) | Unchanged. |
| "Changes nothing" | orchestrators/persistence read paths | — | `loadState`/`loadMergedScopeConfig` only read. The probe confirms no byte change. |

## Standard Stack

No new library. The phase uses what is already in the tree.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typebox` | `^1.1.38` (in tree) | tool parameter schemas (`Type.Object`, `Type.Optional`, `Type.Union`, `Type.Literal`) | Already used by `tools.ts`. Pi validates TypeBox/JSON Schema [VERIFIED: node_modules/@earendil-works/pi-ai/dist/utils/validation.js:40-60] |
| `@earendil-works/pi-coding-agent` | 1.5.0 (dev) | `pi.registerTool` host | Through `platform/pi-api.ts` types only |
| `@cucumber/cucumber` | 13.3.0 | behavioral tests | [VERIFIED: node_modules/@cucumber/cucumber/package.json] |
| `node:test` + `strong-mock` | in tree | unit pair | per `typescript-unit-tests` skill |

**Installation:** none.

## Package Legitimacy Audit

Not applicable: the phase installs no external package. `node scripts/install-test-peers.mjs` filled `node_modules/.cache/optional-peers` in this worktree (pi-mcp-adapter@7.0.0, pi-subagents@0.84.0, @quintinshaw/pi-dynamic-workflows@3.15.0). It is the repository's own frozen script, and `npm run test:cucumber*` runs it anyway.

**Packages removed due to [SLOP] verdict:** none. **Packages flagged [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```text
scripted model (features/lib/scripted-model, one script row = one model call)
   │  tool call {name, arguments}
   ▼
Pi agent loop ── prepareToolCall ── validateToolArguments(schema) ──✗──► toolResult isError:true
   │                                   "Validation failed for tool …"      text projected by the
   │ ✓ args                                                                 harness to
   ▼                                                                        "invalid arguments: <paths>"
tools.ts execute (try/catch → loadFailure, TC-9)
   ├─ list tool:   loadMarketplaceListEntries({cwd, scope?}) → lines "[scope] name -- N plugin(s) -- logical"
   └─ plugin tool: applyFilter → (marketplace? marketplaceExists → not found ⇒ isError:true [D-BG-1003])
                   → loadPluginListPayload({scope?, marketplace?, PL-1 flags forwarded only when narrowed;
                        u ⇒ installed:true too [D-BG-1004]})
                   → renderPluginPayload: header per block, projectRowStatus fold, bucket re-filter
   ▼
{content:[text (redacted)], details, isError?} ──► Pi: isError = result.isError === true
   ▼
next model call carries toolResult → call log (model-calls.jsonl) → "the model receives these calls:"
```

### Recommended Project Structure (files this phase touches)

```
extensions/pi-claude-marketplace/edge/handlers/tools.ts   # the fix (owned)
test/edge/handlers/tools.test.ts                          # unit pair (owned)
features/plugin/model-tools.feature                       # scenarios (owned; seeds rewritten)
features/step_definitions/plugin/model-tools.steps.ts     # NOT needed (see below)
```

### Pattern 1: Optional scope on the list tool (D-BG-1002)
**What:** Copy the plugin tool's `scope` union into `LIST_MARKETPLACES_PARAMS`, then forward it with the existing conditional spread.
**Verified (probe B):** the shape below gives `[user] extras -- 1 plugin(s) -- {home}/marketplaces/extras` for `{"scope":"user"}`, and `failed: invalid arguments: scope` for `{"scope":"everywhere"}`.
```typescript
// Source: the probe edit applied to tools.ts (restored afterwards); scope union verbatim from tools.ts:74-78
const LIST_MARKETPLACES_PARAMS = Type.Object({
  scope: Type.Optional(
    Type.Union([Type.Literal("user"), Type.Literal("project")], {
      description: 'Scope to look in: "user" or "project". Default: both scopes.', // reword at discretion
    }),
  ),
});
// buildMarketplaceListResult(pi, ctx, params) …
const entries = await loadMarketplaceListEntries({
  cwd,
  ...(params.scope !== undefined && { scope: params.scope }),
});
// execute(_toolCallId, params, _signal, _onUpdate, ctx) → buildMarketplaceListResult(pi, ctx, params)
```
Pi's `registerTool` infers `params` from the schema, so `params.scope` is typed `"user" | "project" | undefined`. Update the file header comment (line 5 says "empty params") and the "no scope filter on this tool" comment at lines 134-138.

### Pattern 2: Not-found as an error result (D-BG-1003)
```typescript
// tools.ts:497-502 today returns content + details only; add isError: true
return {
  content: textContent(`Marketplace "${params.marketplace}" not found.`),
  isError: true,
  details: { marketplaces: [] },
};
```
`ListToolResult.isError?: true` already exists (tools.ts:98-99). Its doc comment says "Set on the load-failure result only." and must be reworded.

### Pattern 3: Load installed rows when the unavailable bucket is asked (D-BG-1004)
```typescript
// tools.ts:366-370 today:
//   ...(buckets.i && { installed: true }),
// fix (probe B verified):
...((buckets.i || buckets.u) && { installed: true }),
```
Probe B: `{"unavailable":true}` now returns `eps` (disabled), `gamma` (partially-available), and `npmp` (unavailable), and no installed row. `{"installed":true}` and `{"available":true}` are unchanged. Update the PL-1 comment above (lines 358-365) to name the disabled fold.

### Pattern 4: Reworded filter descriptions (discretion)
Today [VERIFIED: tools.ts:79-91]: `"Include plugins installed in state.json."`, `"Include manifest-declared plugins that are not installed but are installable."`, `"Include manifest-declared plugins that are not installable on this system."`. Suggested wording:
- installed: `"Include installed plugins that are enabled."`
- unavailable: `"Include manifest-declared plugins that are not installable on this system, and installed plugins that are disabled."`

The unit registration test (`tools.test.ts:961-1015`) pins these strings. No feature pins descriptions.

### Anti-Patterns to Avoid
- **Adding a scope check in `execute`:** Pi refuses the value first, so such a branch is dead and breaks 100% direct coverage. CONTEXT forbids it.
- **Throwing for not-found:** D-BG-1001 forbids it. Pi would relay the raw message.
- **Sending an all-true filter bag instead of nothing when no filter is set:** it strands `remote`/`partially-available` (tools.ts:282-288 comment). The fix must stay inside the `buckets.narrowed` spread.
- **`additionalProperties: false` on the schemas:** out of scope. It would make Pi refuse unknown keys, a behavior change no requirement asks for.
- **A changes-nothing scenario with every form as its own call:** 13 calls make a 196-row table (see Pitfall 2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scope validation | a check in `execute` | the TypeBox union + Pi's validator | Pi refuses before `execute`. The harness projects the text to `invalid arguments: scope`. |
| Reading tool results in scenarios | a new verb step | `the model receives these calls:` (`model.steps.ts:97-105`) | It is the only shared step that marks a turn compared. Every turn must be compared (world.ts:1195). |
| Remembering/checking bytes | a new step | `the config and installation record bytes of the {word} scope are remembered` / `… are unchanged` (`config.steps.ts:170-175, 240-247`) | Already reads `claude-plugins.json` + `state.json` |
| Checking installed artifacts | a new step | `the {word} scope stages these skills and prompts:` (`plugin/installation.steps.ts:403-415`) | Lists the staged skills and prompts, sorted |
| Every list status | a new fixture writer | the `list-filters.feature` Background steps (all shared) | Probe A ran them under the scripted-model Pi unchanged |

## Exact texts the model receives (probe evidence, Q1)

Probe A ran against the unfixed `tools.ts` and probe B against the temporary fix. The fixture is the `list-filters.feature` Background (lines 7-51) with `lima | 1.0.0` added to `extras` (an available plugin in the user scope, so its count of 1 installed differs from its 2 offered), run after `Given pi runs with the scripted model` and before `Given the user has started a new pi session`. Probe files: `/tmp/claude-1000/-home-acolomba-pi-claude-marketplace/45e74ef7-b24a-4893-854b-b4c04365a440/scratchpad/phase-10/probes/probe.feature`, `.../probe2.feature`, `.../probe.steps.ts`; outputs under `.../probes/out/` (`full.json`, `fixed.json`, `*.raw.json`). [VERIFIED: probe runs, exit 0, both scenarios' steps passed except the deliberate ENOENT probe]

Line format [VERIFIED: tools.ts:264-276, 437-447]: block header `Marketplace <name> (<scope>)`; row `"  " + "[bucket] <name>"`, then `"  " + <version>` if any, then `"  " + "(<reasons joined by ', '>)"` if any; lines joined by `\n`, no trailing newline. Blocks are sorted by name case-insensitively, then project before user (`orderPluginListBlocks`, list-orphan-fold.ts:67-76), and the rows inside a block by name.

As Gherkin cells (Gherkin turns `\n` in a cell into a newline and trims only the spaces at the cell's ends, so `\n  [` keeps its two spaces [VERIFIED: node_modules/@cucumber/gherkin/dist/GherkinLine.js:53-69]; existing features use `\n` the same way, for example `features/agent/invocation.feature:117`):

**List tool `{}`** (unchanged by the fix):
```
pi_claude_marketplace_list returned: [project] tools -- 3 plugin(s) -- {home}/marketplaces/tools\n[user] extras -- 1 plugin(s) -- {home}/marketplaces/extras
```
`tools` counts alpha, delta, and eps (the disabled plugin counts: `Object.keys(record.plugins)`), and offers 7. `extras` counts kilo and offers 2 (D-BG-1005 pinned).

**List tool `{"scope":"user"}`**. Today (A): the same both-scope text (natural red). Fixed (B):
```
pi_claude_marketplace_list returned: [user] extras -- 1 plugin(s) -- {home}/marketplaces/extras
```
**`{"scope":"project"}`** fixed: `pi_claude_marketplace_list returned: [project] tools -- 3 plugin(s) -- {home}/marketplaces/tools`
**`{"scope":"everywhere"}`**. Today: the both-scope text as `returned:`. Fixed: `pi_claude_marketplace_list failed: invalid arguments: scope`

**Plugin tool `{}`** (same today and fixed; every cheap status):
```
pi_claude_marketplace_plugin_list returned: Marketplace extras (user)\n  [installed] kilo  1.0.0\n  [available] lima  1.0.0\nMarketplace tools (project)\n  [installed] alpha  1.0.0\n  [available] beta  1.0.0\n  [installed] delta  1.0.0  (unsupported component)\n  [unavailable] eps  1.0.0\n  [unavailable] gamma  1.0.0  (unsupported component)\n  [available] ghp\n  [unavailable] npmp  1.0.0  (unsupported source)
```
Status → line: installed `kilo`; upgradable `alpha` shows the **installed** version `1.0.0`, not the candidate 2.0.0; partially-installed `delta (unsupported component)`; disabled `eps` → `[unavailable] eps  1.0.0` with no reason; available `beta`/`lima`; remote `ghp` → `[available] ghp` with **no version** (the git-repository manifest entry declares none); unavailable `npmp (unsupported source)`; partially-available `gamma (unsupported component)`. Partially-upgradable was not probed. The unit test pins its shape `  [installed] alpha  1.0.0  (lsp)` (tools.test.ts:678-692). With an output style it would read `(unsupported component)` [ASSUMED, by analogy with `delta`].

**`{"installed":true}`** (same today and fixed):
```
pi_claude_marketplace_plugin_list returned: Marketplace extras (user)\n  [installed] kilo  1.0.0\nMarketplace tools (project)\n  [installed] alpha  1.0.0\n  [installed] delta  1.0.0  (unsupported component)
```
**`{"available":true}`** (same today and fixed):
```
pi_claude_marketplace_plugin_list returned: Marketplace extras (user)\n  [available] lima  1.0.0\nMarketplace tools (project)\n  [available] beta  1.0.0\n  [available] ghp
```
**`{"unavailable":true}`**. Today (A, the bug: no `eps`):
```
pi_claude_marketplace_plugin_list returned: Marketplace extras (user)\n  (no plugins)\nMarketplace tools (project)\n  [unavailable] gamma  1.0.0  (unsupported component)\n  [unavailable] npmp  1.0.0  (unsupported source)
```
Fixed with Pattern 3 only (B). The `extras` header is now **bare**:
```
pi_claude_marketplace_plugin_list returned: Marketplace extras (user)\nMarketplace tools (project)\n  [unavailable] eps  1.0.0\n  [unavailable] gamma  1.0.0  (unsupported component)\n  [unavailable] npmp  1.0.0  (unsupported source)
```
With the recommended `(no plugins)` change (Open Question 1), `Marketplace extras (user)` is followed by `\n  (no plugins)` again. [ASSUMED, not probed: it follows from moving the check after the re-filter]

**`{"installed":true,"unavailable":true}`** (same today and fixed; it shows that the disabled row survives the re-filter once loaded):
```
… Marketplace extras (user)\n  [installed] kilo  1.0.0\nMarketplace tools (project)\n  [installed] alpha  1.0.0\n  [installed] delta  1.0.0  (unsupported component)\n  [unavailable] eps  1.0.0\n  [unavailable] gamma  1.0.0  (unsupported component)\n  [unavailable] npmp  1.0.0  (unsupported source)
```
**`{"scope":"user"}`** → `Marketplace extras (user)\n  [installed] kilo  1.0.0\n  [available] lima  1.0.0`. **`{"scope":"project"}`** and **`{"marketplace":"tools"}`** → the `tools (project)` block of the unfiltered text.

**`{"marketplace":"ghost"}`**. Today: `pi_claude_marketplace_plugin_list returned: Marketplace "ghost" not found.` (natural red). Fixed: `pi_claude_marketplace_plugin_list failed: Marketplace "ghost" not found.`
**`{"marketplace":"extras","scope":"project"}`** (extras exists only in user). Today `returned:`, fixed `failed: Marketplace "extras" not found.`

Raw log: every probe-A result has `isError: false`. In probe B, `isError: true` on exactly the invalid-scope list call and the two not-found calls [VERIFIED: out/full.raw.json, out/fixed.raw.json]. The model sees only `content` text. `details` are not in the call rows (`script.ts:349-368`).

## Pi argument validation (Q2)

[VERIFIED: probe `/tmp/claude-1000/-home-acolomba-pi-claude-marketplace/45e74ef7-b24a-4893-854b-b4c04365a440/scratchpad/phase-10/probes/validate.mjs` calling `validateToolArguments` from this worktree's `pi-ai`]:
```
empty-user OK {"scope":"user"}
empty-bogus OK {"scope":"everywhere"}
scoped-user OK {"scope":"user"}
scoped-bogus ERR "Validation failed for tool \"scoped-bogus\":\n  - scope: expected \"user\"\n\nReceived arguments:\n{\n  \"scope\": \"everywhere\"\n}"
scoped-null OK {}
scoped-extra OK {"scope":"user","installed":true}
```
- `Type.Object({})` (today's list tool) **accepts and ignores** any key, including an invalid scope. Pi compiles with `coerce: true` [VERIFIED: validation.js:12] and TypeBox objects allow extra properties.
- An invalid value for the `scope` union fails with the path `scope`. The harness reads it as `invalid arguments: scope` (`features/lib/upstream/pi.ts:47-64`; the first line must be `Validation failed for tool "<tool>":`). End to end (probe B): `pi_claude_marketplace_list failed: invalid arguments: scope`.
- `null` for an optional field is coerced to absent. Unknown keys such as `{"remote":true}` are ignored on both tools (no requirement asks otherwise).
- The validated arguments are a `structuredClone`. The `tool call` row shows the script's arguments verbatim, in key order: `tool call pi_claude_marketplace_plugin_list {"marketplace":"extras","scope":"project"}`.

## How the scripted model plays several calls (Q3)

- One script row is one model call: a `tool` row returns that one tool call; Pi runs it and calls the model again for the next row; a `reply` row ends the turn [VERIFIED: script.ts:26-39, 158-215; world.ts unusedScriptSteps].
- `the model receives these calls:` compares **every non-system message of every call of the last turn**, in call order, against the whole table (`model.steps.ts:95-105`, `script.ts:370-381`). Each call repeats the conversation so far. So a turn with N tool calls has N+1 model calls and **(N+1)² rows** [VERIFIED: probe A 14 calls → 196 rows; probe B 15 → 225].
- Row texts: user rows hold the prompt; assistant rows hold `tool call <tool> <JSON args>` (the final reply row holds the reply text); tool rows read `<tool> returned: <text>` or `<tool> failed: <text>` from `isError` (`script.ts:349-368`).
- The turn must be compared before the next prompt and before the scenario ends (`world.ts:797-801, 1195`). Only `model.steps.ts:97` among the shared steps compares a plain turn, so every prompt needs a full call table.
- A second prompt in the same session carries the first turn's messages, so splitting the calls over prompts does not shrink the tables.

**Sizing rule:** 1 tool call → 4 rows; 2 → 9; 3 → 16; 4 → 25. The seed shape (one call + reply) is the cheapest. For "changes nothing", use 3-4 calls with combined parameters over a smaller fixture (see the scenario plan).

## Project scope and paths in scripted-model scenarios (Q4)

- The profile Pi runs in the run's sandbox: `PiProcess.start(sandbox, …)`, with `sandbox.cwd` as the project [VERIFIED: world.ts:1068-1100, 320-331]. `the marketplace "X" is added to the project scope` and `the user has run "… --scope project"` go to the profile Pi when they come after `Given pi runs with the scripted model` (`this.pi` is the scenario Pi). Probe A added `tools` to the project scope and installed into it under the scripted-model Pi; the list tool shows `[project] tools`.
- `<source.logical>` reads `{home}/marketplaces/<name>` for both scopes, because the marketplace steps publish under the home's `marketplaces` root. The call-step projection turns the path into `{home}`.
- `the user has run "/claude:plugin install delta@tools --scope project --partial"` is accepted as an info setup under the scripted-model Pi (probe A).

## Remembered bytes (Q5)

- The step reads `claude-plugins.json` and `pi-claude-marketplace/state.json` with no ENOENT handling [VERIFIED: config.steps.ts:55-61]. On a scope with neither file it **fails**: `Error: ENOENT: no such file or directory, open '/tmp/pi-cm-features-…/project/.pi/claude-plugins.json'` (probe scenario 2, the deliberate failure).
- After `marketplace add` in a scope, both files exist. Probe user-scope config after `add` only: `{"schemaVersion":1,"marketplaces":{"fixtures":{"source":"<abs>"}}}`. After install and disable (probe A, project): `"plugins": {"alpha@tools": {}, "delta@tools": {}, "eps@tools": {"enabled": false}}`. So the changes-nothing scenario needs at least one marketplace added to **each** scope.
- After 13 tool calls, both scopes' bytes were unchanged, and the staged rows were `skill alpha-skill`, `skill delta-skill` (project; disabled `eps` stages nothing) and `skill kilo-skill` (user). The probe's `the {word} scope stages these skills and prompts:` tables passed [VERIFIED: probe A].

## Filter inconsistencies (Q6)

1. **Disabled plugin unreachable by any single filter: CONFIRMED.** Probe A: the unfiltered list shows `[unavailable] eps  1.0.0`; `{"installed":true}` omits it (the loader admits `disabled`, list-flow.ts:233-241, and the tool re-filter drops the `u` bucket); `{"unavailable":true}` omits it (the loader admits `bucket === "unavailable"` only, list-flow.ts:266-268). **The fix works without admitting other rows** (probe B): only `eps` is added under `unavailable`, and `installed`/`available` are unchanged. `opts.installed` is read only in `shouldShow` (grep of `orchestrators/plugin/*.ts`), so forwarding it changes nothing else.
2. **Two shapes of an empty block (NEW).** A block that the loader's filter empties prints `  (no plugins)` (tools.ts:443-447: `mp.plugins.length === 0`). A block that the tool's re-filter empties prints a bare header (the unit test `tools.test.ts:1368-1418` pins this, citing WR-05: "the (no plugins) body belongs to a marketplace that declares none"). The WR-05 intent already does not hold in practice: probe A prints `(no plugins)` for `extras` under `unavailable`, though `extras` declares 2 plugins. The D-BG-1004 fix moves `unavailable` from the first shape to the second for every marketplace that has installed rows. See Open Question 1.
3. `remote` under `available` and `partially-available` under `unavailable`: **consistent** (probe: `ghp` under available, `gamma` under unavailable; the tool forwards `remote`/`partial` with them, tools.ts:366-370).
4. `{not in manifest}` rows: an installed record the manifest omits stays `[installed]` with the reason; a disabled one is `[unavailable] … (not in manifest)`. The unit tests pin the reasons (tools.test.ts:1142-1252). With the fix, the disabled one is reachable through `unavailable`. **Consistent** after the fix.
5. An upgradable row shows the installed version and no hint of the upgrade (MSG-PL-4, by design). Not a bug for this phase.
6. Inside one scope, the list tool orders marketplaces by `state.json` insertion order, not by name (`list.ts:95` `Object.values(state.marketplaces)`; the plugin tool sorts). A scenario with one marketplace per scope does not depend on it. LOW, not in scope.
7. Unknown arguments are ignored silently on both tools (Q2). Not in scope.

## Files the change touches and who owns them (Q7)

| File | What pins / changes | Owned? |
|------|---------------------|--------|
| `extensions/pi-claude-marketplace/edge/handlers/tools.ts` | the fix | yes |
| `test/edge/handlers/tools.test.ts` | `:420-452` "registers pi_claude_marketplace_list with an empty parameter schema" (`parameters: { type: "object", properties: {} }`) → new schema plus a new title; `:961-1016` plugin registration pins the `installed`/`unavailable` descriptions; `:1591-1622`, `:1624-1649`, `:1768-1793` not-found results without `isError` → add `isError: true`; `:1368-1418` header-alone (changes only if Open Question 1 is accepted); new cases: list tool narrows to `user` and to `project`, and the unavailable filter returns a disabled row and drops an installed one | yes |
| `features/plugin/model-tools.feature` | seeds rewritten, new scenarios | yes |
| `test/edge/register.test.ts:3526`, `test/index.test.ts:1474` | pin tool **names** only | not touched |
| `features/mcp-server/{listing,builtin-direct,agent-grants}.feature`, `features/plugin/project-trust.feature` | list tool **names** only (`listing.steps.ts:192` filters by the `pi_claude_marketplace_` prefix) | not touched |
| `docs/competitive-analysis/pi-plugins.md:434` | says "`pi_claude_marketplace_list` takes no parameters" (stale after D-BG-1002) | **NOT owned → parent line** |
| `CHANGELOG.md` | user-visible change (list scope, not-found error, disabled under `unavailable`) | **never edited → parent line** |
| `.planning/PROJECT.md` Key Decisions | closure of json-output D-03 (D-BG-1001 / P10-DC-01) if the parent records it | **never edited → parent line** |
| `extensions/pi-claude-marketplace/edge/register.ts:233-234`, `orchestrators/marketplace/shared.ts:806-815` | doc comments name the tools; nothing about parameters | not touched |

No unowned feature file or integration test pins the list tool's parameters, the not-found success, or the descriptions (grep of `pi_claude_marketplace` across `features test docs extensions`).

## Scenario plan and red-proof strategy (Q8)

All scenarios: no implementation tag. Every step comes from the shared modules (no verb module). A shared Background is allowed only if every scenario needs it. Recommendation: a Background holding `Given pi runs with the scripted model`, the full fixture above (list-filters Background plus `lima` in `extras`), and `Given the user has started a new pi session`. Each scenario then only scripts, prompts, and compares. The invalid-scope seed works over the fixture too.

| # | Scenario (title idea) | Call(s) | Rows | Red proof |
|---|----------------------|---------|------|-----------|
| 1 | The model reads the marketplaces of both scopes the list tool returns (seed 1 rewritten) | list `{}` | 4 | **Planted:** `loadMarketplaceListEntries({ cwd, scope: "user" })` in `buildMarketplaceListResult` → project line missing |
| 2 | A list call with a scope returns only that scope's marketplaces | list `{"scope":"user"}`, list `{"scope":"project"}` | 9 | **Natural** (today both return both scopes) |
| 3 | A list call with a scope the tool does not accept reaches the model as invalid arguments | list `{"scope":"everywhere"}` | 4 | **Natural** (today `returned:` with both scopes) |
| 4 | The model reads each plugin's install status the plugin list tool returns | plugin `{}` | 4 | **Planted:** `case "disabled": return "installed";` in `projectRowStatus` (or `remote` → `"unavailable"`) |
| 5a | The installed filter returns only the installed plugins | plugin `{"installed":true}` | 4 | **Planted:** in `projectRowStatus`, move `case "partially-installed":` to the `return "unavailable"` group → `delta` disappears from the installed result |
| 5b | The available filter returns the available and the not yet cloned plugins | plugin `{"available":true}` | 4 | **Planted:** remove `remote: true` from the forwarded `available` bag → `ghp` missing |
| 5c | The unavailable filter returns the plugins this system cannot install and the disabled ones | plugin `{"unavailable":true}` | 4 | **Natural** (today `eps` missing) |
| 6 | Two filters return the plugins of either one (optional, PL-1 union) | plugin `{"available":true,"unavailable":true}` | 4 | Planted (as 5b) |
| 7 | A plugin list call naming an unknown marketplace reaches the model as an error | plugin `{"marketplace":"ghost"}` | 4 | **Natural** |
| 8 | A plugin list call naming a marketplace of the other scope reaches the model as an error | plugin `{"marketplace":"extras","scope":"project"}` | 4 | **Natural** |
| 9 | A plugin list call with a scope the tool does not accept reaches the model as invalid arguments (seed 2, kept) | plugin `{"scope":"everywhere"}` | 4 | **Planted:** replace the plugin tool's `scope` union with `Type.String(…)` → the call returns `No marketplaces configured.` (the loader filters every block out) |
| 10 | No call of either tool changes the config, the installation record, or what is installed | 3-4 calls, combined parameters (below) | 16-25 | **Planted:** a write in a tool body, e.g. `await appendFile(path.join(ctx.cwd, ".pi", "pi-claude-marketplace", "state.json"), "\n")` at the top of `buildPluginListResult` (node:fs is fine for a never-committed plant). `… bytes of the project scope are unchanged` fails |

5a/5b/5c may be one `Scenario Outline` (3 variants: `<filter>` arguments plus a `<result>` cell; Gherkin replaces placeholders inside table cells, as `features.md`'s own Outline example does with `| tools | <source> |`). 7/8 may be one scenario with two calls (9 rows), or two scenarios.

**Scenario 10 shape:** add a small fixture (or reuse the Background), remember both scopes, and use 3 tool calls so the table has 16 rows. For example: list `{}` (all-scope path), plugin `{"marketplace":"tools","scope":"project","installed":true,"available":true,"unavailable":true}` (every plugin parameter in one call; an all-true bag takes the narrowed union path), plugin `{"marketplace":"ghost"}` (error path). Then check both scopes' bytes are unchanged, and `the project scope stages these skills and prompts:` / `the user scope stages these skills and prompts:` with the values from probe A (`alpha-skill`, `delta-skill` / `kilo-skill`). List `{"scope":…}` is covered by scenario 2. If D-BG-1006's "each parameter form" is read literally (13 calls), the table is 196 rows. Recommend the combined-parameter reading and log it as a dubious choice.

**How to get the natural reds after wave 1:** before writing the fix, record the base commit; in wave 2 run `git show <base>:extensions/pi-claude-marketplace/edge/handlers/tools.ts > extensions/pi-claude-marketplace/edge/handlers/tools.ts`, run `npx cucumber-js features/plugin/model-tools.feature`, save the output to the scratch dir, then `git checkout -- extensions/pi-claude-marketplace/edge/handlers/tools.ts`. Same for each planted mutation: edit, run, restore, then confirm `git status --short` is clean. Never commit a plant. Rerun a failing run once before calling it red (child rules).

## Common Pitfalls

### Pitfall 1: The fix silently changes the empty-block shape
**What goes wrong:** after D-BG-1004, `{"unavailable":true}` prints a bare `Marketplace extras (user)`, where `{"available":true}` on a block with no available rows prints `(no plugins)`.
**How to avoid:** decide Open Question 1 before writing literals. Pin the chosen shape in scenario 5c and in the unit test `:1368`.
**Warning signs:** a 5c literal copied from today's output (`(no plugins)`) fails after the fix for the wrong reason.

### Pitfall 2: Quadratic call tables
**What goes wrong:** one prompt with many tool calls makes a table nobody can review (13 calls → 196 rows).
**How to avoid:** one call per scenario where possible; ≤ 3-4 calls in the changes-nothing scenario.

### Pitfall 3: Remembering bytes of a scope that has no config yet
**What goes wrong:** `ENOENT … claude-plugins.json`.
**How to avoid:** add a marketplace to each scope before the `remembered` step.

### Pitfall 4: A green scenario that proves nothing
**What goes wrong:** scenarios 1, 4, 5a, 5b, 9 pass on today's code; without a recorded planted red they look like proofs but are not.
**How to avoid:** record each planted mutation and its failing assertion in the SUMMARY (child rules).

### Pitfall 5: Coverage of the new branches
**What goes wrong:** `(buckets.i || buckets.u)` and the list tool's `params.scope !== undefined` spread each have two arms. 100% branch coverage needs a unit case for each arm.
**How to avoid:** the existing filter cases cover `i`-only and `u`-only. Add list-tool cases with and without scope.

### Pitfall 6: Description strings drift between unit test and product
**What goes wrong:** the registration tests compare the whole `parameters` object.
**How to avoid:** change both in one commit.

## Code Examples

The fix patterns are above (Patterns 1-3). A unit case for D-BG-1004 in the existing style:
```typescript
// Shape follows tools.test.ts:1079-1140 ("skips a row whose bucket the filter excludes")
test("returns a disabled plugin under the unavailable filter and drops an installed one", async (t) => {
  // arrange: seedScope(scope.cwd, "project", [{ name: "skip-mp", plugins: [
  //   { name: "alpha", manifestVersion: "1.0.0", installed: { version: "1.0.0" } },
  //   { name: "delta", manifestVersion: "1.0.0", installed: { version: "1.0.0", disabled: true } } ] }])
  // expected content: "Marketplace skip-mp (project)\n  [unavailable] delta  1.0.0"
  // expected details row: { status: "disabled", name: "delta", id: "delta@skip-mp", reasons: [], version: "1.0.0", scope: "project" }
  // act: registration.execute("call-1", { unavailable: true }, undefined, undefined, ctx)
});
```
(The `disabled` details-row shape is quoted from tools.test.ts:697-711.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pi ignored a returned `isError` (0.87.1), so D-03 left "throw instead" open | Pi 1.5.0 copies `result.isError === true` into the tool result | Pi 1.x | D-BG-1001 closes D-03: return, never throw. The probe proves `failed:` reaches the model |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A partially-upgradable row made with an output style reads `[installed] <name>  <installed version>  (unsupported component)` | Exact texts | Low: only if the planner adds that status. The unit test pins the shape with `(lsp)` |
| A2 | Moving the `(no plugins)` check after the re-filter makes `{"unavailable":true}` print `Marketplace extras (user)\n  (no plugins)` | Exact texts / OQ1 | Low: a straightforward code path; the executor's first run shows it |

## Open Questions

1. **One empty-block shape or two?** (blocks scenario 5c's literal and unit `:1368`)
   - What we know: today `(no plugins)` appears when the loader empties a block (even one with declared plugins), and a bare header when the tool's re-filter empties it (WR-05 comment). D-BG-1004 moves the `unavailable` filter into the bare-header case. CONTEXT's specifics expect `(no plugins)` for "a block the filter empties".
   - Recommendation: print `  (no plugins)` whenever a block keeps no rows. Do the `kept.length === 0` check after the loop, keep the declared-none case, change the unit test at `:1368` (title and comment) and the WR-05 comment. Log it as a dubious choice (Medium). The alternative is to keep the code and pin the bare header in 5c. That is cheaper, but the model sees two shapes for the same fact.
2. **"Each parameter form" in D-BG-1006:** literal (13 calls, 196 rows) or combined parameters (3 calls, 16 rows)? Recommendation: combined (see Scenario 10). Log it as a dubious choice (Low).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v26.13.0 (CI uses 24; mind errno wording, not relevant here) | — |
| Pi | profile Pi | ✓ | 1.5.0 (`node_modules`) | — |
| Optional peer cache | adapter profile shared Pi (`pi-process.ts:156-172`) | ✓ (installed by this research into the worktree's gitignored `node_modules/.cache/optional-peers`) | pi-mcp-adapter 7.0.0 | `node scripts/install-test-peers.mjs` (network) |
| cucumber accepts a feature path outside `features/` | probes | ✓ (probe ran from the scratch dir with an extra `--import`) | 13.3.0 | — |
| `/tmp` inodes | cucumber sandboxes | ✓ 4% used at research time | — | report ENOSPC per rules |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit), `@cucumber/cucumber` 13.3.0 (behavioral) |
| Config file | `cucumber.json` (default profile = adapter, `parallel: 8`) |
| Quick run (unit owner) | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/edge/handlers/tools.test.ts` |
| Direct coverage of the pair | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/tools.ts` |
| Feature iteration | `npx cucumber-js features/plugin/model-tools.feature` (from the worktree root; one scenario: `npx cucumber-js --profile adapter --name '<title>'`) |
| Feature-file gate | `npm run check:features` |
| Full suite (gate) | `npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOL-01 | both scopes / one scope / invalid scope on list tool | unit + cucumber | owner test; `npx cucumber-js features/plugin/model-tools.feature` | unit ✅ (cases to add); feature ✅ seed (to rewrite) |
| TOOL-02 | statuses and the three filters, disabled under unavailable | unit + cucumber | same | ✅ / to add |
| TOOL-03 | unknown marketplace error, other-scope error, invalid scope error, changes nothing | unit + cucumber | same | ✅ seed 2 / to add |

### Sampling Rate
- **Per task commit:** the hook's `npm run check:commit` (static + unpaired + direct coverage of the staged `tools.ts` pair), plus `npx cucumber-js features/plugin/model-tools.feature` for any task that touches the feature or the product.
- **Per wave merge:** `npm run check` (static, unpaired, integration, cucumber under both profiles, all-pair direct coverage). Redirect to a scratch file and run in the background with the exit code written to a file.
- **Phase gate:** `npm run check` green on the combined tree before verification.

### Wave 0 Gaps
None. The test infrastructure exists, the peer cache is installed in this worktree, and no new step module or fixture is needed.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | read-only tools; the scope only narrows |
| V5 Input Validation | yes | TypeBox schema, enforced by Pi before `execute` |
| V7 Error Handling / Logging | yes | `isError` results with redacted text (PMOD-04); never throw raw (TC-9) |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A credential in a marketplace name or source leaking into model text | Information disclosure | `textContent` → `redactCredentials` stays on every content string, the not-found text included |
| A raw exception message reaching the model | Information disclosure | `loadFailure` catch (TC-9) unchanged |
| A model-triggered write through a read tool | Tampering | read-only loaders; scenario 10 pins the bytes |

## Sources

### Primary (HIGH confidence)
- Probe runs in this worktree: `/tmp/claude-1000/-home-acolomba-pi-claude-marketplace/45e74ef7-b24a-4893-854b-b4c04365a440/scratchpad/phase-10/probes/{probe.feature,probe2.feature,probe.steps.ts,validate.mjs,run1.log,run2.log,out/}`
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` (read whole), `orchestrators/plugin/list-flow.ts:150-271, 660-773`, `orchestrators/marketplace/list.ts:64-101`, `orchestrators/marketplace/shared.ts:800-830`
- `features/lib/scripted-model/script.ts` (read whole), `features/lib/upstream/{index,pi}.ts`, `features/step_definitions/{model,config,session,command}.steps.ts`, `features/step_definitions/{marketplace/publishing,plugin/installation}.steps.ts`, `features/support/world.ts`, `features/support/pi-process.ts:140-180`
- `node_modules/@earendil-works/pi-ai/dist/utils/validation.js`, `node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js:480-600`, `node_modules/@cucumber/gherkin/dist/GherkinLine.js`
- `test/edge/handlers/tools.test.ts` (registration, version, filter, not-found, and header-alone cases)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Nothing new.
- Architecture / fix shape: HIGH. Probed end to end with the fix applied.
- Exact texts: HIGH, from probes (A1/A2 are the only assumptions).
- Pitfalls: HIGH, observed.

**Research date:** 2026-11-08
**Valid until:** while Pi stays at 1.5.0 and `tools.ts`/`list-flow.ts` are unchanged (stable, about 30 days)
