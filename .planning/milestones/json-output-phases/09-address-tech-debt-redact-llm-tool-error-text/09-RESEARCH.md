# Phase 9: Address tech debt: redact LLM tool error text - Research

**Researched:** 2026-10-10
**Domain:** Credential redaction at the LLM tool return boundary (`edge/handlers/tools.ts`), TypeScript strict, `node:test`
**Confidence:** HIGH (every behavior claim below was probed against the live tree at `0b7ed9dc`, Node v26.11.1)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The user said "none, make your best decisions" when offered the four gray
areas on 2026-10-10. Claude made every decision below.

#### Redaction reach
- **D-01:** Redact every string the two tools return to the model in
  `content` text: the content lines, the empty-state lines, the
  marketplace-not-found line, and every error line. Rationale: the phase's job
  is to make credentials absent from LLM tool text. Fixing only channel 1
  would close the theoretical leak and leave the confirmed one (channel 3)
  open. `redactCredentials` changes only credential spans, so text without a
  credential keeps its bytes, and every existing tool test expectation holds.
- **D-02:** Do not change `details`. They already go through `presentCascade`,
  which redacts `source.url` and the subject names (PMOD-04). Adding a second
  pass would duplicate work without changing any output.

#### Uncaught throws
- **D-03:** Neither tool's `execute` may let a thrown value reach Pi. Each tool
  catches everything its execute body can throw and returns
  `{ content: [{ type: "text", text: <redacted error line> }], isError: true, details: { marketplaces: [] } }`,
  the shape TC-9 already uses for the plugin-list tool.
  - Plugin-list tool: move the `marketplaceExists` call inside the existing
    try, so one catch covers the whole body. The error line stays
    `Failed to load plugin list: <message>`.
  - Marketplace-list tool: add the same catch. The error line is
    `Failed to load marketplace list: <message>`, which mirrors the plugin-list
    wording.

  Rationale: Pi's generic path sends the raw `error.message` to the model,
  and redaction cannot run on text the extension never sees.

#### Redaction seam
- **D-04:** Redact at the tool return boundary in `edge/handlers/tools.ts`,
  using `redactCredentials` from `shared/redact-credentials.ts`. The tools stay
  out of the notification resolve step. Rationale: tool `content` is not a
  notification presentation. PMOD-04 D-07 places redaction "in resolve at every
  serialization site", and for the tool surface that serialization site is the
  tool's return value. The `edge` zone may import `shared/`, so no boundary or
  rule-pack change is needed. The planner chooses the exact form: a single
  module-private helper that builds the text part, or a call at each return
  site. With either form, no return path may skip redaction.
- **D-05:** Redact credentials only, not absolute paths. The TC-9 test asserts
  that the `state.json` path appears in the error text. Path redaction is a
  separate policy (`shared/redact-absolute-paths.ts`) that applies at chosen
  sites, and a path is not a secret.

#### Proof and closure
- **D-06:** Prove the fix with owner tests in `tests/edge/handlers/tools.test.ts`.
  Use the existing hermetic-scope helpers (`createHermeticScope`, `seedScope`,
  `registerToolUnderTest`). Include at least:
  - a marketplace whose `url` source carries userinfo and a `ghp_` token. The
    content line shows `https://***@host/...`, and the token is absent from
    the whole result;
  - a plugin-list load failure whose message carries a credential. The error
    line is redacted, and `isError: true`;
  - a marketplace-list load failure (for example, an unsupported `state.json`
    schema). The tool returns the `isError` result and does not throw;
  - a `marketplaceExists` failure. The plugin-list tool returns the `isError`
    result and does not throw.

  `tools.ts` keeps 100% direct coverage. Do not extend the AUTH-09
  architecture gate (`tests/architecture/no-credential-leak.test.ts`). That
  gate statically scans named state-write and credential files, and
  project policy forbids planted-violation tests for gates.
- **D-07:** Change the deferred item's status in
  `.planning/phases/04-wire-schema-and-json-strategy/deferred-items.md` from
  `open` to `closed` and point it at phase 9. Add no new REQUIREMENTS.md ID:
  trace the work to PMOD-04, whose goal (credentials absent from what the
  extension emits) now also covers LLM tool text, and to the audit's Verdict
  item 1. After this phase, re-run the milestone audit before
  `/gsd-complete-milestone`.
- **D-08:** The milestone invariants hold unchanged. The notify wire corpus
  and `docs/output-catalog.md` re-diff empty, because tool output is not part
  of either. `npm run check` stays green, with no new fallow suppression.

### Claude's Discretion
- Every decision above (the user delegated all four areas).
- How the redaction is shaped inside `tools.ts`: one helper or per-site calls
  (D-04).
- The fixture used to make a load throw a credential-bearing message (D-06),
  as long as it stays hermetic and makes no network call.

### Deferred Ideas (OUT OF SCOPE)
- Absolute-path redaction for LLM tool error text (D-05). This is a separate
  policy question, so it was not raised as a backlog item.
</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement ID is mapped to this phase (D-07). The work traces to existing IDs:

| ID / Item | Description | Research Support |
|-----------|-------------|------------------|
| PMOD-04 | "Credentials -- URL userinfo and any token -- are absent from every presentation, text and JSON" [VERIFIED: .planning/REQUIREMENTS.md:40-43] | The tool `content` surface is the one emitter PMOD-04's resolve-step redaction never reached; Findings F1-F3 show all three channels and the fixtures that reproduce each |
| Audit Verdict item 1 | "Decide the phase 04 deferred item (LLM tool error text outside redaction)" [VERIFIED: .planning/json-output-MILESTONE-AUDIT.md:146-149] | D-07 closure; Pitfall 5 shows the status word GSD's audit actually treats as closed |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Never commit to `main`; branch is `features/json`. Conventional Commits, title 5-72 chars, body lines <= 80, no GSD phase/milestone mentions in commit messages.
- Before `git commit`: `SKIP=npm-check pre-commit run --files <changed files>`; then `git commit` in the foreground; never `--no-verify`, never `--amend` to fix a failed hook, never rebase.
- Read `skills/typescript-google-style-review/SKILL.md` and `skills/typescript-comments/SKILL.md` for every `.ts` edit; `skills/typescript-unit-testing/SKILL.md` for `tests/**/*.ts`.
- GSD gates (wave post-merge, phase gate) run `npm run check` on the combined tree; a passing pre-commit hook is not a gate verdict (`skills/local-verification/SKILL.md`).
- `npm run check` = typecheck + ESLint (`--max-warnings 0`, sonarjs cognitive complexity 15) + `lint:workflows` + fallow (dead-code, cycles, health `maxCognitive 15`/`maxCyclomatic 20`, dupes, boundaries, rule pack) + Prettier + source/test pairing + unpaired tests + integration + 100% direct coverage per pair.
- Output channel IL-2: tools never notify; no `process.stdout`/`console` in the extension (fallow rule pack).
- Comments cite durable IDs (PMOD-04, D-NN, TC-9); no "Phase 9", "Plan 01", "Pitfall N", and no narration of the replaced code ("the former catch ...").
- Every plan `SUMMARY.md` includes `## Threat Flags`.
- Subagent tests must use the hermetic home (`createHermeticScope` -> `createHermeticEnvironment` sets `HOME` and `PI_CODING_AGENT_DIR` to a temp root) [VERIFIED: tests/platform/hermetic-environment.ts:29-57].
- Upstream parity: none applies; Claude Code has no counterpart to these two tools (CONTEXT.md domain section).

## Summary

The change is one production file (`extensions/pi-claude-marketplace/edge/handlers/tools.ts`), its owner test (`tests/edge/handlers/tools.test.ts`), and a one-word status edit in a planning file. No package, config, boundary, or rule-pack change is needed: `tools.ts` already imports from `shared/` (`errorMessage`, line 44), so adding `redactCredentials` from `shared/redact-credentials.ts` stays inside the edge zone's allow-list.

All three channels named in CONTEXT.md reproduce on the live tree, hermetically and with zero `https.request` calls. Channel 3 (the marketplace-list content line) leaks a `url` source's userinfo verbatim today. Channel 1 (the plugin-list catch) leaks whenever the thrown message carries a credential, and `persistence/state-io.ts:377` produces exactly such a message for a stored `url` source that fails revalidation. Channel 2 (uncaught throws from the marketplace-list tool and from `marketplaceExists`) reaches Pi, which turns `error.message` into tool text with no redaction.

Two findings change how the plan should read the locked decisions. First, Pi 0.87.1 ignores an `isError` property on a *returned* result: the tool-result message's `isError` is `false` unless `execute` throws. D-03's shape is still correct for redaction, but `isError: true` is a field the model never sees as an error flag (Open Question 1). Second, GSD's milestone audit treats only `resolved` or `acknowledged` as closed in `deferred-items.md`. The literal `status: closed` that D-07 names stays counted as open by `audit-open` (Pitfall 5).

**Primary recommendation:** Add one module-private text-content builder that applies `redactCredentials`, plus one module-private load-failure builder. Route every `content` through the text builder. Wrap each tool's whole execute body as `try { return await <body>(...) } catch (err) { return <failure>(...) }`. Write the four D-06 cases (plus an optional not-found-line case) with literal expected strings, and mark the deferred item `status: resolved`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Credential redaction of tool `content` | Edge (`edge/handlers/tools.ts`) | Shared (`shared/redact-credentials.ts`, the one redactor) | D-04: the tool return value is the serialization site for this surface; resolve never sees tool text |
| Catching load failures into a tool error result | Edge (`tools.ts` execute bodies) | -- | D-03: redaction can only run on text the extension sees before Pi's generic catch |
| Redaction of `details` | Shared (`presentCascade` in `shared/notification-present.ts:209`) | -- | D-02: already done; unchanged |
| Throwing the state/load errors | Persistence (`state-io.ts::loadState`) via Orchestrators loaders | -- | Unchanged; producers keep raw messages (PMOD-04 redacts at serialization, never in a producer) |
| `sourceLogical` (keeps userinfo) | Domain (`domain/source.ts:755-783`) | -- | Out of scope; other callers rely on it (CONTEXT canonical refs) |

## Findings (live-tree probes)

### F1: Every content/return site in `tools.ts` [VERIFIED: extensions/pi-claude-marketplace/edge/handlers/tools.ts, read this session]

`grep -n 'type: "text"'` finds six sites:

| Line | Tool | Text | Redacted today? |
|------|------|------|-----------------|
| 101 | marketplace list | `"No marketplaces configured."` | no (static) |
| 131 | marketplace list | `lines.join("\n")`, each line `` `[${scope}] ${record.name} -- ${pluginCount.toString()} plugin(s) -- ${logical}` `` (line 114) with `logical = sourceLogical(source)` (line 110) | **no -- confirmed leak (channel 3)** |
| 441 | plugin list | `` `Marketplace "${params.marketplace}" not found.` `` (LLM-supplied param) | no |
| 464-466 | plugin list catch | `` `Failed to load plugin list: ${errorMessage(err)}` `` with `isError: true` | **no (channel 1)** |
| 481 | plugin list | `"No marketplaces configured."` | no (static) |
| 500 | plugin list | `lines.join("\n")` from `renderPluginPayload` | no |

Throw paths that escape `execute` today (channel 2):
- Marketplace list: `await loadMarketplaceListEntries({ cwd })` (line 97) and everything after it (`openNotificationSnapshot`, `presentCascade`, `toWireMarketplaces`, lines 120-129) have no catch.
- Plugin list: `await marketplaceExists(...)` (lines 434-438) runs before the `try` at line 453; `openNotificationSnapshot`/`presentCascade` (lines 489-498) run after the catch.

Probe output (scratch harness calling the registered `execute` against a temp `HOME`/`PI_CODING_AGENT_DIR`; paths elided):
```
CH3 list: {"content":[{"type":"text","text":"[project] url-mp -- 0 plugin(s) -- https://user:ghp_abcdefghijklmnopqrstuv@git.example.com/o/r"}],"details":{"marketplaces":[{"name":"url-mp","scope":"project","plugins":[]}]}}
CH1 plugin: {"content":[{"type":"text","text":"Failed to load plugin list: state.json marketplace \"bad\" has an invalid url source: ftp://user:ghp_abcdefghijklmnopqrstuv@git.example.com/o/r.git"}],"isError":true,"details":{"marketplaces":[]}}
list THREW: state.json marketplace "bad" has an invalid url source: ftp://user:ghp_abcdefghijklmnopqrstuv@git.example.com/o/r.git
plugin+mp THREW: state.json marketplace "bad" has an invalid url source: ftp://user:ghp_abcdefghijklmnopqrstuv@git.example.com/o/r.git
list THREW: state.json at /tmp/probe-tools-.../project/.pi/pi-claude-marketplace/state.json has an unsupported schema version
plugin+mp THREW: state.json at /tmp/probe-tools-.../project/.pi/pi-claude-marketplace/state.json has an unsupported schema version
https.request calls: 0
```
The `details` of the url-source list result carry no source at all (`{"name":"url-mp","scope":"project","plugins":[]}`), which confirms D-02 needs no change.

### F2: What `redactCredentials` does and does not redact [VERIFIED: extensions/pi-claude-marketplace/shared/redact-credentials.ts:34-55]

Verbatim patterns:
```ts
const userinfo = /(?<![a-z0-9+.-])([a-z0-9+.-]+:\/\/)[^\s/?#]+@/gi;
const accessToken = /\b(x-access-token:)[^\s@/]+/gi;
const bearer = /\b(Bearer[ \t]+)([\w.~+/-]*\w=*)/gi;
const githubToken = /gh[pousr]_[A-Za-z0-9]{16,}|github_pat_\w{16,}/g;
```
- Redacts: any `scheme://userinfo@` (any scheme, `ftp://` included) to `scheme://***@`; `x-access-token:<secret>` to `x-access-token:***`; `Bearer <token-shaped>` to `Bearer ***`; `ghp_/gho_/ghu_/ghs_/ghr_` + 16+ alphanumerics and `github_pat_` + 16+ word chars to `***`. Userinfo runs first, so a token inside userinfo collapses into one `***@`.
- Does not redact: absolute paths (D-05), scp-form `git@host:o/r` (no `scheme://`), tokens shorter than the 16-char body floor, non-GitHub token shapes (for example a GitLab `glpat-...` or a bare password without userinfo), `Bearer` prose (`isTokenShaped` false).
- Text with no match keeps its bytes. The existing test expectations contain only temp paths (`/tmp/tools-<label>-XXXXXX/...`), plugin names, versions, and reason words. None contains `://`, `gh?_` + 16 alphanumerics, `x-access-token:`, or `bearer ` + a token, so routing them through the redactor changes nothing [VERIFIED: owner suite read this session; labels at every `createHermeticScope(t, ...)` call are plain words].

Probe outputs for the new expectations (literal strings to put in the tests):
```
https://user:ghp_abcdefghijklmnopqrstuv@git.example.com/o/r   -> https://***@git.example.com/o/r
Failed to load plugin list: state.json marketplace "bad-mp" has an invalid url source: ftp://user:ghp_abcdefghijklmnopqrstuv@git.example.com/o/r.git
  -> Failed to load plugin list: state.json marketplace "bad-mp" has an invalid url source: ftp://***@git.example.com/o/r.git
Marketplace "https://user:ghp_abcdefghijklmnopqrstuv@git.example.com/o/r" not found.
  -> Marketplace "https://***@git.example.com/o/r" not found.
```

### F3: How Pi relays tool results (pinned 0.87.1 in node_modules) [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/bundle/chunks/chunk-OJP47DM6.js, read this session]

Verbatim (minified):
```js
async function executePreparedToolCall(prepared,signal,emit){...try{let result=await prepared.tool.execute(...);return ...,{result,isError:!1}}catch(error){return ...,{result:createErrorToolResult(error instanceof Error?error.message:String(error)),isError:!0}}...}
function createErrorToolResult(message){return{content:[{type:"text",text:message}],details:{}}}
function createToolResultMessage(finalized){return{role:"toolResult",...,content:finalized.result.content??[],details:finalized.result.details,...,isError:finalized.isError,...}}
function wrapToolDefinition(definition,ctxFactory){return{...,execute:(toolCallId,params,signal,onUpdate,ctx)=>definition.execute(toolCallId,params,signal,onUpdate,ctx??ctxFactory?.())}}
```
- A thrown error's raw `message` becomes the model-visible text, as CONTEXT channel 2 states.
- A **returned** result's own `isError` property is never read: `executePreparedToolCall` sets `isError:!1` on every resolved `execute`, and `createToolResultMessage` uses `finalized.isError`. `wrapToolDefinition` passes the extension's result through untouched. Only an `afterToolCall`/`tool_result` hook can set `isError` on a resolved call.
- `AgentToolResult` in 0.87.1 declares `content`, `details`, `usage?`, `terminate?`, and no `isError` [VERIFIED: node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-agent-core/dist/types.d.ts:366-378]. Its `AgentTool.execute` doc reads "Throw on failure instead of encoding errors in `content`."
- The extension's peer floor is `>=0.86.1`; the 0.86.1 bundle was not inspected [ASSUMED: same behavior].

### F4: Hermetic fixtures for each D-06 case [VERIFIED: probes above; extensions/pi-claude-marketplace/persistence/state-io.ts:370-407, 433-463 read this session]

| Case | Fixture | Thrown message (source line) | `ctx.cwd` reads | `getAllTools` reads |
|------|---------|------------------------------|-----------------|---------------------|
| Channel 3, list tool content line | `saveState(locationsFor("project", cwd).extensionRoot, { schemaVersion: 2, marketplaces: { "url-mp": { name, scope: "project", source: { kind: "url", raw: "https://user:ghp_abcdefghijklmnopqrstuv@git.example.com/o/r.git" }, addedFromCwd: cwd, manifestPath, marketplaceRoot, plugins: {} } } })`. The schema types `source` as `Type.Unknown()`; `loadState` recomputes `url` from `raw` via `revalidateStoredUrlSource`. No manifest file is needed: the list tool reads only state and config. | -- | 1 | 3 (non-empty path) |
| Channel 1, credential in plugin-list catch | `writeFile(stateJsonPath, JSON.stringify({ schemaVersion: 3, marketplaces: { "bad-mp": { name: "bad-mp", scope: "project", source: { kind: "url", raw: "ftp://user:ghp_abcdefghijklmnopqrstuv@git.example.com/o/r.git" }, addedFromCwd, manifestPath, marketplaceRoot, plugins: {} } } }))` (TC-9's `writeFile` pattern) | `` `state.json marketplace "${mpName}" has an invalid url source: ${raw}` `` (state-io.ts:377): `parsePluginSource("ftp://...")` returns `kind: "unknown"`, so revalidation throws before schema validation | 1 | 0 |
| Marketplace-list load failure | `writeFile(stateJsonPath, JSON.stringify({ schemaVersion: 4 }))` (the TC-9 fixture) | `` `state.json at ${stateJsonPath} has an unsupported schema version` `` (state-io.ts:463) | 1 | 0 |
| `marketplaceExists` failure | same `schemaVersion: 4` fixture, `params = { marketplace: "<any>" }` | same as above, thrown from `loadVisibleMarketplaces` (orchestrators/marketplace/shared.ts:653-672) | 1 (the payload load never runs) | 0 |
| Optional: not-found line with an LLM-typed credential | empty scope, `params = { marketplace: "https://user:ghp_abcdefghijklmnopqrstuv@git.example.com/o/r" }` | -- | 1 | 0 |

The project-scope state path is `locationsFor("project", scope.cwd).stateJsonPath`. Both loaders iterate `["project", "user"]`, so a broken project-scope file throws first. A broken file in the agent dir (user scope) would also work, but the project path matches TC-9.

### F5: Corpus and catalog reach [VERIFIED: git show --stat 0a11761d; tools.ts imports lines 36-52]

- `scripts/notify-corpus.mjs` no longer exists. Commit `0a11761d` ("chore: retire verified notification corpus tools") deleted it and its hook and negative scripts. The frozen baseline sits at `.planning/phases/01-presentation-model/notify-corpus/`. Phase 8 already handled this: "the corpus tool is retired, so 'unchanged' is a path-scoped `git diff`" (08-RESEARCH.md:143, 444, 510). The command the orchestrator named (`node scripts/notify-corpus.mjs check`) cannot run.
- Tool output cannot reach either the corpus or the catalog. The corpus captured `ctx.ui.notify` calls ("Captures every `ctx.ui.notify` call the test suites make", a9673e10:scripts/notify-corpus.mjs). `tools.ts` imports `notification-json`, `notification-present`, `notification-run`, and `notification-types`, and does not import `notification-dispatch`, the one `ui.notify` site. The owner suite's `ctx` mock states no `ui` expectation, so any notify attempt would fail the case. `docs/output-catalog.md` documents notify output only (no `pi_claude_marketplace` string appears in it).
- D-08's invariant becomes: `git diff --exit-code <base> -- docs/output-catalog.md .planning/phases/01-presentation-model/notify-corpus/` exits 0, and the catalog gate suites (`tests/architecture/catalog-uat/*`, run by `test:unpaired` inside `npm run check`) stay green.

### F6: Existing tests that pin tool bytes [VERIFIED: tests/edge/handlers/tools.test.ts read this session; owner run 36/36 pass; `npm run test:coverage:direct -- tests/edge/handlers/tools.test.ts` exit 0 at 0b7ed9dc]

- Every rendering case compares the whole result with `assert.deepStrictEqual(listed, expectedResult)`, then `networkCallCount() === 0`, then `verifyBoundary()`.
- TC-9, "reports a tool error when the recorded state declares an unknown schema" (lines 1605-1633): plugin-list tool, no `marketplace` param, `reads: 1`, no inventory reads, expected text `` `Failed to load plugin list: state.json at ${locations.stateJsonPath} has an unsupported schema version` ``, `isError: true`, `details: { marketplaces: [] }`. D-05 keeps this byte-identical.
- The not-found cases (lines 1494-1552) pin `'Marketplace "proj-mp" not found.'` / `'Marketplace "ghost-mp" not found.'` with `reads: 1`.
- "narrows to the named marketplace" (lines 1374-1432) pins `reads: 2`: one `ctx.cwd` read in `marketplaceExists`, one in `loadToolPluginPayload`. `createToolBoundary` states `when(() => ctx.cwd).thenReturn(...).times(reads)`, so any change in how often the body reads `ctx.cwd` fails `verifyBoundary()` (Pitfall 3).
- Each tool's non-empty path promises 3 `pi.getAllTools()` reads (one notification run); every error and empty path promises 0.

## Standard Stack

No new dependency. Everything needed is in-repo.

| Asset | Location | Purpose |
|-------|----------|---------|
| `redactCredentials(text)` | `extensions/pi-claude-marketplace/shared/redact-credentials.ts:34` | The one redactor (PMOD-04 D-07) |
| `errorMessage(err)` | `extensions/pi-claude-marketplace/shared/errors.ts` (already imported by tools.ts:44) | Non-Error narrowing for the catch text |
| `PiTextContentBlock` | `extensions/pi-claude-marketplace/platform/pi-api.ts:79-82` (`type: "text"; text: string;`) | Structural type for a helper's return; tools.ts already imports types from `platform/pi-api.ts` |
| `node:test`, `node:assert/strict`, `strong-mock` | existing | Owner tests |
| `createHermeticScope`, `seedScope`, `locationsFor`, `saveState`, `registerToolUnderTest`, `marketplaceRootIn`, `manifestPathIn` | `tests/edge/handlers/tools.test.ts` (module-private helpers) and production imports already in the suite | Fixtures |

## Package Legitimacy Audit

Not applicable: this phase installs no external package.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### Data flow after the change

```
LLM tool call
  -> Pi executePreparedToolCall -> wrapToolDefinition -> tool.execute(...)
       try {
         return await <tool body>(pi, params, ctx)
            loaders (state.json / config / manifest)   -- may throw
            line rendering (sourceLogical, names, ...)  -- may carry userinfo
            openNotificationSnapshot -> presentCascade -> toWireMarketplaces   (details: already redacted, D-02)
            return { content: textContent(text), details }      <- redactCredentials here (D-01, D-04)
       } catch (err) {
         return loadFailure("<plugin|marketplace> list", err)   <- "Failed to load ...: <errorMessage(err)>" through textContent
       }
  -> Pi: resolved -> toolResult message { content, details, isError: false }   (F3)
```
No path returns `content` that bypasses `textContent`, and no throw reaches Pi.

### Recommended shape (Claude's discretion, D-04)

```ts
// Source: in-repo; types and names verified against tools.ts and pi-api.ts this session.
import { redactCredentials } from "../../shared/redact-credentials.ts";

import type { ExtensionAPI, ExtensionContext, PiTextContentBlock } from "../../platform/pi-api.ts";

/**
 * PMOD-04 / D-04: the one builder of tool `content`. Tool text reaches the
 * model without a presentation, so the redaction that resolve applies to
 * notifications runs here. A credential-free text keeps its bytes.
 */
function textContent(text: string): PiTextContentBlock[] {
  return [{ type: "text", text: redactCredentials(text) }];
}

/**
 * TC-9 / D-03: a load failure becomes a tool result instead of a throw, so
 * Pi never relays an unredacted `error.message`.
 */
function loadFailure(subject: string, err: unknown): {
  content: PiTextContentBlock[];
  isError: true;
  details: { marketplaces: never[] };
} {
  return {
    content: textContent(`Failed to load ${subject}: ${errorMessage(err)}`),
    isError: true,
    details: { marketplaces: [] },
  };
}
```
Execute bodies:
```ts
async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
  try {
    return await listMarketplaces(pi, ctx);       // the current body, moved verbatim
  } catch (err) {
    return loadFailure("marketplace list", err);
  }
},
```
```ts
async execute(_id, params, _signal, _onUpdate, ctx) {
  try {
    return await listPlugins(pi, params, ctx);    // current body incl. marketplaceExists, minus its own try
  } catch (err) {
    return loadFailure("plugin list", err);
  }
},
```
- The extracted bodies keep every `ctx.cwd` read where it is today: `const { cwd } = ctx;` in the marketplace body, `ctx.cwd` in the `marketplaceExists` call and inside `loadToolPluginPayload` (Pitfall 3).
- Inside `listPlugins`, the old `let payload; let rendered; try {...} catch` collapses to plain `const payload = await loadToolPluginPayload(...)` and `const { lines, marketplaces } = renderPluginPayload(...)`. The outer catch owns failure. This removes the two `let` declarations the inner try needed.
- If the planner prefers to keep the body inline, the D-03 bullet "move `marketplaceExists` inside the existing try" works too. The try must then also cover `openNotificationSnapshot`/`presentCascade`, which can throw ("catches everything its execute body can throw"). The extracted-body form satisfies the style rule "A `try` block covers only the statements that can throw" with a single statement, and it keeps each execute's cognitive complexity low.
- The return type of an extracted body: annotate it (module-private functions in this file annotate returns). A precise annotation is the union of the result shapes. `platform/pi-api.ts` does not re-export `AgentToolResult` today (grep finds no match), so the body cannot name that type without a new re-export there. A local `interface` for the result shape is simpler. Do not import `@earendil-works/pi-coding-agent` directly: the `pi-peer-chokepoint` rule allows it only in `platform/pi-api.ts`.

### Anti-Patterns to Avoid
- **`return <promise>` without `await` inside the try:** an async rejection then escapes the catch and reaches Pi unredacted. typescript-eslint `return-await` (`error-handling-correctness-only` in `strictTypeChecked`) flags it. Write `return await`.
- **Redacting inside a producer (`state-io.ts`, `sourceLogical`):** PMOD-04 redacts at serialization, never in a producer. `sourceLogical` has other callers (CONTEXT).
- **Calling `redactCredentials` in the tests to build expected values:** the testing skill forbids computing expected data with production code. Use the literal strings from F2.
- **Two near-identical catch blocks:** a shared `loadFailure` helper avoids a fallow `dupes` clone group and keeps both error lines in one grammar.
- **Re-redacting `details`:** D-02. It adds nothing; the list-tool details carry no source at all (F1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Credential detection | A new regex in `tools.ts` | `redactCredentials` | Single redactor policy (PMOD-04 D-07); the userinfo scan is tuned for linear time and `@`-in-password |
| Non-Error narrowing | A local `err instanceof Error ? ... : String(err)` | `errorMessage` from `shared/errors.ts` | The existing TC-9 comment records why: no seeded load throws a non-Error, so a local copy would be an uncoverable branch (100% direct coverage) |
| Hermetic env | Manual `HOME` juggling | `createHermeticScope` | Also installs the `https.request` counter and registers cleanup |

## Common Pitfalls

### Pitfall 1: A content site skips redaction
**What goes wrong:** One of the six `content` sites keeps an inline `{ type: "text", text }` literal.
**How to avoid:** Every `content:` goes through `textContent`. Check: `grep -c 'type: "text"' extensions/pi-claude-marketplace/edge/handlers/tools.ts` returns `1` (the helper alone).
**Warning signs:** The count is above 1. The channel-3 test catches only the list line, so the grep is the cheap whole-file proof.

### Pitfall 2: The catch does not see async rejections
**What goes wrong:** `try { return listPlugins(...) }` without `await` returns a rejected promise past the catch.
**How to avoid:** `return await`; the D-06 cases (marketplace-list failure, `marketplaceExists` failure) resolve rather than reject only when this is right.

### Pitfall 3: `ctx.cwd` read counts drift
**What goes wrong:** Hoisting `const cwd = ctx.cwd` once in the plugin body changes the read count from 2 to 1 on the `marketplace`-param path. "narrows to the named marketplace" (`reads: 2`) then fails at `verifyBoundary()` with an unmet `times(2)`.
**How to avoid:** Move the bodies verbatim; keep `ctx.cwd` at the `marketplaceExists` argument and inside `loadToolPluginPayload`. New error-path cases state `reads: 1` and no inventory reads.

### Pitfall 4: `isError: true` read as "Pi marks the result as an error"
**What goes wrong:** A plan or verifier claims the model sees an error flag. In Pi 0.87.1 it does not (F3); the field is inert on a resolved `execute`.
**How to avoid:** Assert the returned object's shape (D-03), and do not claim Pi-side error semantics in comments or SUMMARY text. See Open Question 1.

### Pitfall 5: `status: closed` stays open in the GSD audit
**What goes wrong:** D-07 says change `open` to `closed`. `scanDeferredItems` in `.claude/gsd-core/bin/lib/audit.cjs` drops only `resolved` and tallies `acknowledged`, and treats every other status as open. Probe on the live file: replacing `status: open` with `status: closed` still parses as `["closed"]`. `query audit-open` today lists "Phase 04: LLM plugin tool error text is outside the redacted notification model status: open" among 3 unresolved deferred items.
**How to avoid:** Write `status: resolved`. That word means "fixed for real", which is what this phase does, and it meets D-07's intent of taking the item off the open list. Add a pointer line (for example `**Resolved by:** phase 09 (LLM tool content redaction)`). Verify with `node .claude/gsd-core/bin/gsd-tools.cjs query audit-open` and check that the Phase 04 entry is gone.

### Pitfall 6: Stale comments in `tools.ts`
**What goes wrong:** The TC-9 catch comment (lines 457-461) and the header's IL-2 paragraph describe the code as it stands today. After the move they would narrate a shape that no longer exists.
**How to avoid:** Restate the comments in the present tense with IDs (PMOD-04, D-03, TC-9). Do not write "the former catch" or "moved from". The header could add one line: tool `content` is redacted at return (PMOD-04).

## Code Examples

### Owner test, channel 3 (list tool content line)
```ts
// Source: pattern of tools.test.ts "renders one line per marketplace..." (lines 446-488), values from F2/F4 probes.
test("redacts the credential in a url source on the marketplace line", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "list-url-credential");
  const locations = locationsFor("project", scope.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      "url-mp": {
        name: "url-mp",
        scope: "project",
        source: { kind: "url", raw: "https://user:ghp_abcdefghijklmnopqrstuv@git.example.com/o/r.git" },
        addedFromCwd: scope.cwd,
        manifestPath: manifestPathIn(scope.cwd, "url-mp"),
        marketplaceRoot: marketplaceRootIn(scope.cwd, "url-mp"),
        plugins: {},
      },
    },
  });
  const { ctx, registration, verifyBoundary } = registerToolUnderTest(
    registerListMarketplacesTool,
    { value: scope.cwd, reads: 1 },
    3,
  );
  const expectedResult = {
    content: [{ type: "text", text: "[project] url-mp -- 0 plugin(s) -- https://***@git.example.com/o/r" }],
    details: { marketplaces: [{ name: "url-mp", scope: "project", plugins: [] }] },
  };

  // act
  const listed = await registration.execute("call-1", {}, undefined, undefined, ctx);

  // assert
  assert.deepStrictEqual(listed, expectedResult);
  assert.strictEqual(scope.networkCallCount(), 0);
  verifyBoundary();
});
```
- The whole-value `deepStrictEqual` already proves the token is absent from the whole result (D-06). A separate `!JSON.stringify(...).includes("ghp_")` would be a standalone negative assertion, which the testing skill discourages.
- The exact `details` block was observed in the probe (F1). Confirm `schemaVersion: 2` vs `3` in `saveState`: `seedScope` uses 2 and the schema accepts 1|2|3 [VERIFIED: state-io.ts:327-339].

### Owner test, `marketplaceExists` failure
```ts
// Source: TC-9 pattern (tools.test.ts:1605-1633).
const expectedResult = {
  content: [{ type: "text", text: `Failed to load plugin list: state.json at ${locations.stateJsonPath} has an unsupported schema version` }],
  isError: true,
  details: { marketplaces: [] },
};
const listed = await registration.execute("call-1", { marketplace: "broken-mp" }, undefined, undefined, ctx);
```
with `registerToolUnderTest(registerListPluginsTool, { value: scope.cwd, reads: 1 })` and no inventory reads. The marketplace-list failure case is the same with `registerListMarketplacesTool`, `{}` params, and `Failed to load marketplace list: ...`.

The interpolated `${locations.stateJsonPath}` is the TC-9 precedent, a fixture path and not a production computation, so it does not break the expected-value rule.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node scripts/notify-corpus.mjs check` | Path-scoped `git diff --exit-code` of the frozen baseline + catalog | `0a11761d` (2026-10-09) | D-08's corpus clause is a diff, not a command |
| `lint:type-members` pins | Deleted by #236 (`d7213bc2`) | 2026-10-05 | No line:col pin to repin after editing `tools.ts` (WINDOWS.md entry 34 records it moot) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pi 0.86.1 (the peer floor) relays tool results the same way as the installed 0.87.1 (thrown message becomes text; returned `isError` ignored) | F3 | Low: redaction is correct either way; only the meaning of `isError: true` differs |
| A2 | Session transcripts persist tool result text to disk (Pi `SessionManager` `.jsonl` files seen in the same bundle), which raises the stakes of a leak beyond the model call | Security Domain | Low: does not change the fix |

## Open Questions

1. **Should the error results throw instead of returning `isError: true`?**
   - What we know: D-03 locks the returned shape. In Pi 0.87.1 a returned `isError` is ignored, so the model gets the redacted text with `isError: false` on the tool-result message (F3). Pi's `AgentTool.execute` doc says "Throw on failure instead of encoding errors in `content`." A `throw new Error(redactedLine)` would carry both redaction and Pi's error flag.
   - What's unclear: whether the user values the existing TC-9 return shape (stable, tested) over Pi's error flag.
   - Recommendation: implement D-03 as written. The phase goal is redaction, and D-03 achieves it. Record the inert-flag fact in the SUMMARY so the user can decide later. Do not change the shape inside this phase without asking.
2. **`status: closed` vs `status: resolved` (D-07).**
   - Recommendation: `resolved` (Pitfall 5). It is the only word GSD's audit treats as closed-and-fixed, and the user delegated all decisions. Name the deviation in the plan.
3. **Optional not-found-line case.** D-01 covers the LLM-supplied `marketplace` param. With one shared helper, coverage does not need a separate case. The case costs about 20 lines and fails if someone inlines that one return. Recommendation: include it. It is the only D-01 site whose text the LLM controls.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | tests, check | yes | v26.11.1 (engines `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`) | -- |
| npm | scripts | yes | 11.20.0 | -- |
| `@earendil-works/pi-coding-agent` | types, bundle facts | yes | 0.87.1 in node_modules | -- |
| GSD tools | D-07 verification | yes | `.claude/gsd-core/bin/gsd-tools.cjs` | -- |

No network is needed. Every fixture is local.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` + `strong-mock` |
| Config file | none (npm scripts in `package.json`) |
| Quick run command | `node --test tests/edge/handlers/tools.test.ts` (36 cases, ~3 s at baseline) |
| Pair coverage | `npm run --silent test:coverage:direct -- tests/edge/handlers/tools.test.ts; echo $?` (exit 0 at baseline) |
| Full suite command | `npm run check; echo $?` (unpiped; see the project memory "Green runs that checked nothing") |

### Decision -> Check Map
| Decision | Behavior | Type | Automated Command | Exists? |
|----------|----------|------|-------------------|---------|
| D-01 | Every content site redacts | static + unit | `grep -c 'type: "text"' extensions/pi-claude-marketplace/edge/handlers/tools.ts` -> `1`; `grep -c 'redactCredentials(' extensions/pi-claude-marketplace/edge/handlers/tools.ts` -> `1`; `node --test --test-name-pattern="redact" tests/edge/handlers/tools.test.ts` | new cases: Wave 0 |
| D-01 | Existing expectations unchanged | diff | `git diff <base> -- tests/edge/handlers/tools.test.ts \| grep -E '^-[^-]'` -> no output, or only import lines the new cases need | yes |
| D-02 | `details` unchanged | unit + static | Existing details expectations pass untouched (line above); `grep -c 'presentCascade(' extensions/pi-claude-marketplace/edge/handlers/tools.ts` -> `2` | yes |
| D-03 | Neither tool throws; isError shape | unit | `node --test --test-name-pattern="tool error\|does not throw\|Failed to load" tests/edge/handlers/tools.test.ts` (the marketplace-list failure and `marketplaceExists` failure cases resolve with `isError: true`) | new cases: Wave 0 |
| D-04 | Seam in `tools.ts`, boundary clean | static | `grep -n 'from "../../shared/redact-credentials.ts"' extensions/pi-claude-marketplace/edge/handlers/tools.ts`; `npm run --silent fallow; echo $?` -> 0 | -- |
| D-05 | Paths not redacted | unit | TC-9 "reports a tool error when the recorded state declares an unknown schema" passes unmodified | yes |
| D-06 | Four required cases + 100% pair coverage | unit + coverage | `node --test tests/edge/handlers/tools.test.ts`; `npm run --silent test:coverage:direct -- tests/edge/handlers/tools.test.ts; echo $?` -> 0 | Wave 0 |
| D-06 | AUTH-09 gate untouched | diff | `git diff --exit-code <base> -- tests/architecture/no-credential-leak.test.ts` | yes |
| D-07 | Deferred item closed | doc + tool | `grep -n 'status: resolved' .planning/phases/04-wire-schema-and-json-strategy/deferred-items.md`; `node .claude/gsd-core/bin/gsd-tools.cjs query audit-open > "$TMPDIR/ao.txt"; grep -c 'LLM plugin tool error text' "$TMPDIR/ao.txt"` -> `0` | -- |
| D-08 | Catalog + frozen corpus unchanged | diff | `git diff --exit-code <base> -- docs/output-catalog.md .planning/phases/01-presentation-model/notify-corpus/` | yes |
| D-08 | No new suppression | diff | `git diff <base> -U0 -- . ':(exclude).planning' \| grep -E '^\+.*(fallow-ignore\|eslint-disable\|@ts-expect-error\|@ts-ignore\|node:coverage)'` -> no output | -- |
| D-08 | Gate green | gate | `npm run check; echo $?` -> 0; `npx fallow audit --base <base> --format json --quiet` verdict `pass` | -- |

`<base>` = the phase start commit (`0b7ed9dc` at research time; record the real one when the plan starts).

### Sampling Rate
- **Per task commit:** the pre-commit hook (`check:commit`, staged pairs) plus `node --test tests/edge/handlers/tools.test.ts` while editing.
- **Per wave merge / phase gate:** `npm run check` on the combined tree, plus the D-07/D-08 diff and audit commands above.

### Wave 0 Gaps
- [ ] New cases in `tests/edge/handlers/tools.test.ts`: channel 3 list line, credential-bearing plugin-list failure, marketplace-list failure, `marketplaceExists` failure, optional not-found-line redaction. Write them first; the first, second, and fourth (and the optional fifth) fail RED against the current tree, and the third rejects instead of resolving.
- No framework or fixture-file gaps: the suite's helpers already cover everything.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | partial | The `marketplace` param is LLM-supplied text echoed into content; redacted through `textContent` |
| V6 Cryptography | no | -- |
| V7 Error Handling and Logging | yes | Error text returned to the model goes through `redactCredentials` (no secrets in error output) |
| V8 Data Protection | yes | Credentials in stored `url` sources are kept out of tool text sent to the model provider and into session transcripts (A2) |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Userinfo token in a marketplace URL echoed to the LLM (channel 3) | Information disclosure | `redactCredentials` at the tool return boundary |
| Thrown message carrying a credential relayed by Pi's generic catch (channel 2) | Information disclosure | Catch-all in each `execute`, redact before return |
| Non-GitHub token shapes (e.g. `glpat-...` outside userinfo) | Information disclosure | Not covered by the redactor; accepted residual of PMOD-04 D-05's pattern set, out of scope here |

## Sources

### Primary (HIGH confidence)
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` (full file), `shared/redact-credentials.ts`, `persistence/state-io.ts:327-463`, `domain/source.ts:39-45, 755-783`, `orchestrators/marketplace/shared.ts:653-672`, `orchestrators/marketplace/list.ts:69-110`, `platform/pi-api.ts:72-99`. All read this session.
- `tests/edge/handlers/tools.test.ts` (helpers lines 1-385, cases 386-1634), `tests/platform/hermetic-environment.ts`. Read; owner run 36/36; direct coverage exit 0.
- Pi 0.87.1 bundle `chunk-OJP47DM6.js` (`executePreparedToolCall`, `createErrorToolResult`, `createToolResultMessage`, `wrapToolDefinition`) and `pi-agent-core/dist/types.d.ts:366-378`.
- `.claude/gsd-core/bin/lib/audit.cjs` (`scanDeferredItems`) and `uat.cjs::parseDeferredItemsWithStatus`, plus a live `query audit-open` run.
- Commit `0a11761d` (corpus retirement); `08-RESEARCH.md` precedent for the path-scoped corpus diff.
- Scratch probes (session scratchpad, not committed) reproducing channels 1-3 with zero `https.request` calls.

### Secondary / Tertiary
- None. No web research was needed; the domain is entirely in-repo.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new dependencies; every helper was read.
- Architecture: HIGH. All channels were reproduced live, and the shape fits existing boundaries.
- Pitfalls: HIGH. The read-count, return-await, audit-status, and isError facts were each verified against code or a probe.

**Research date:** 2026-10-10
**Valid until:** 2026-11-09 (stable; re-check F3 if the Pi dev dependency moves past 0.87.1)
