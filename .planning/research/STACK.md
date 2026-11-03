# Stack Research

**Domain:** Cucumber component behavioral tests on a model-free headless Pi, plus a raise of Pi and its three companion extensions to their latest releases (milestone `component-features`)
**Researched:** 2026-10-31
**Confidence:** HIGH for versions, dates and every breaking change listed below. Each one was read from the published npm tarball (`npm pack` into the session scratchpad, never the repo) or run against the tarball's own code. MEDIUM for runtime behavior that the sources document but nobody has run here yet (nested MCP tool calls firing Pi `tool_call`; which extensions a pi-subagents background child loads). LOW for the GitHub state of earendil-works/pi#10470 (WebFetch, which the classify seam rates LOW), but the Pi 1.4.0 source confirms it independently (see Pi below).

## Bottom line

- **No new tool or framework.** `@cucumber/cucumber` 13.3.0 is already the latest release. The faux model provider is part of `@earendil-works/pi-ai`, which Pi already installs. The only `package.json` addition I recommend is an explicit devDependency on `@earendil-works/pi-ai` pinned at exactly `1.4.0`, because the harness imports `@earendil-works/pi-ai/providers/faux` directly and should not depend on npm hoisting.
- **Pi 1.3.0 → 1.4.0 breaks nothing this extension uses.** The extension-API types, `skills.d.ts`, `prompt-templates.d.ts`, the RPC types and `rpc-mode.js`, and the faux provider's `.d.ts` are byte-identical between the two releases.
- **pi-mcp-adapter 5.2.0 → 7.0.0 has one breaking change that matters, and it is a credential leak.** Since 7.0.0 the adapter expands `${NAME:-default}` itself. Text that the bridge writes as a literal, such as `${ANTHROPIC_API_KEY:-}` in an `oauth` value, now expands to the secret when the server connects. I reproduced this with the bridge's own `serializeLiteral` and the two adapters' `interpolateEnvVars`. `bridges/mcp/adapter-escape.ts` must escape the `:-` form, and the AVAR-03 drift guard and the exhaustive property must be re-proved. Everything else the bridge writes or reads did not change: file names, the loader grammar, the status channel and snapshot version, tool naming, lazy connect, the `mcp` proxy tool, and the config writers.
- **pi-subagents 0.74.0 → 0.84.0 fixes the background-agent blocker** and requires Pi ≥ 1.2.0 (since 0.80.0). The two internal modules the integration tests import still exist with the same exports. Every frontmatter key the bridge emits is still parsed.
- **pi-dynamic-workflows 3.14.0 → 3.15.0 keeps the storage rule byte-identical.** It only adds a check that refuses Pi-reserved names (`new`, `compact`, ...) as saved-workflow names. The bridge's `plugin:name` names can never collide with them.
- **Raise the Pi peer floor to `>=1.4.0`.** The extension's own code needs only the 1.0 API. But the pi-subagents floor now needs Pi ≥ 1.2.0, and the cucumber suite will prove only 1.4.0. The milestone already decided this raise. Four tests pin the old ranges and must move with it (see "Tests that pin old behavior").

## Recommended Stack

### Core Technologies

| Technology | Version (publish date, UTC) | Purpose | Why Recommended |
|------------|-----------------------------|---------|-----------------|
| `@earendil-works/pi-coding-agent` | **1.4.0** (2026-10-21T22:48Z); dev `^1.4.0`, peer `>=1.4.0` | Host Pi for unit, integration and cucumber runs | Latest. Its dependencies pin `pi-ai`, `pi-agent-core`, `pi-tui`, `pi-mcp` and `pi-codemode` at exactly `1.4.0`. The extension API, RPC protocol, skill and prompt-template loaders, and `SessionStartEvent.reason` (`startup \| reload \| new \| resume \| fork`) are unchanged from 1.3.0. |
| `@earendil-works/pi-tui` | **1.4.0**; dev `^1.4.0` (peer stays `*`) | TUI primitives | Keeps one deduplicated copy beside Pi 1.4.0, which pins `pi-tui` at exactly 1.4.0. |
| `@earendil-works/pi-ai` | **1.4.0**, exact devDependency (new) | `fauxProvider`, `fauxAssistantMessage`, `fauxToolCall`, `fauxText` from `@earendil-works/pi-ai/providers/faux` | The harness's faux extension imports it directly. Pi's extension loader aliases only `pi-ai`, `/compat`, `/oauth`, `/providers/all` and (new in 1.4.0) `/models`, not `/providers/faux`. So the import resolves through `node_modules`, and it must reach the same copy Pi uses. Pin it **exactly** to the Pi version (not `^`) so npm never installs a second top-level copy. `faux.d.ts` in 1.4.0 is identical to the 1.3.0 copy the spike used. |
| `@cucumber/cucumber` | **13.3.0** (already installed; latest on npm) | Runner | No change. |
| Node | `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` (unchanged) | Runtime | Every companion engine range admits it (`pi-mcp-adapter` `>=20`; pi-subagents and the workflow engine declare none). |

### Optional peers (PIFL-02/PIFL-03: never `dependencies`, `devDependencies` or lockfile packages)

| Peer | Declared now | Declare | Latest (publish date, UTC) | Notes |
|------|--------------|---------|----------------------------|-------|
| `pi-mcp-adapter` | `>=5.2.0 <6` | **`>=7.0.0 <8`** | 7.0.0 (2026-10-26T04:51Z; changelog dates it 2026-10-25). 6.0.0 was 2026-10-22. | Keep the major cap: the AVAR-03 escape depends on the adapter's interpolation passes, and a major can change them (7.0.0 just did). |
| `pi-subagents` | `>=0.74.0` | **`>=0.84.0`** | 0.84.0 (2026-10-29T05:33Z) | 0.x line, open-ended as before. Its peers are `@earendil-works/pi-ai >=1.2.0`, plus `pi-agent-core`, `pi-coding-agent`, `pi-tui` and `typebox` at `*`. |
| `@quintinshaw/pi-dynamic-workflows` | (none) | **`>=3.15.0 <4`**, `optional: true` in `peerDependenciesMeta` | 3.15.0 (2026-10-27T18:28Z); 3.14.0 was 2026-10-06 | New optional peer. The major cap guards the transcribed storage rule in `platform/workflow-home.ts`. Its peers are `pi-coding-agent >=0.80.8`, `pi-tui >=0.80.6` and `typebox *`. |

### Supporting Libraries

None. The harness needs only modules that are already present: the faux provider (Pi), `node:child_process` for the stub MCP server and the companion Pi, and the existing `test/e2e/_rpc.ts` and `features/lib/pi-process.ts`.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `scripts/install-test-peers.mjs` | Puts each optional peer's floor in `node_modules/.cache/optional-peers` | Add `@quintinshaw/pi-dynamic-workflows` to `peerNames`. The scoped name already works with `minVersion` and the `holdsFloor` path join. With the new floors, `--before` caps resolution at 2026-10-29T05:33Z (pi-subagents 0.84.0, the newest floor). `--omit=peer` stays correct: inside Pi, the loader aliases each companion's `@earendil-works/*` imports to the host copies. |
| `scripts/pi.sh` | Manual Pi with companions | `pi_cm_pins` lines 116-120 move to `pi-mcp-adapter@7.0.0`, `pi-subagents@0.84.0` and `@quintinshaw/pi-dynamic-workflows@3.15.0`. Update the comment at lines 107-115. |

## Installation

```bash
# Host Pi and the faux provider (dev only)
npm install -D @earendil-works/pi-coding-agent@^1.4.0 @earendil-works/pi-tui@^1.4.0
npm install -D --save-exact @earendil-works/pi-ai@1.4.0

# package.json peerDependencies / peerDependenciesMeta (hand edit, then `npm install` to sync the lock root):
#   "@earendil-works/pi-coding-agent": ">=1.4.0"
#   "pi-mcp-adapter": ">=7.0.0 <8"
#   "pi-subagents": ">=0.84.0"
#   "@quintinshaw/pi-dynamic-workflows": ">=3.15.0 <4"   (meta: optional: true)

# Optional peers for tests (never in the lockfile)
node scripts/install-test-peers.mjs
```

---

## Per-package change audit

### 1. pi-mcp-adapter 5.2.0 → 7.0.0 (6.0.0 and 7.0.0 are both majors)

The changelog sections in between are 5.3.0, 5.3.1, 5.3.2, 5.4.0, 6.0.0 and 7.0.0. 6.0.0 and 7.0.0 each have one "Breaking" entry, and neither touches anything this extension writes. The behavior that does break the extension is filed under 7.0.0's **Added** section.

| Surface | 5.2.0 | 7.0.0 | Impact | Source |
|---------|-------|-------|--------|--------|
| **`${VAR:-default}` interpolation** | `interpolateEnvVars` pass 1: `.replace(/\$\{(\w+)\}/g, ...)`; `${A:-x}` stays literal | Pass 1: `.replace(/\$\{(\w+)(?::-([^}]*))?\}/g, (_, name, fallback) => environment[name] ?? fallback ?? "")`. The default applies only when the variable is **unset**, not when it is empty. | **BREAKING / security.** The bridge writes `${A:-x}`, `pre${A:-}post` and `${B:-dflt}` unescaped (the `TRIGGER` regex in `adapter-escape.ts` matches `$` only before `{\w+}`). Probe result: under 5.2.0 they stay literal; under 7.0.0 they become `SECRET`, `preSECRETpost` and `dflt`. A literal `oauth` value, a `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` env value, or a nested default such as `${B:-${A:-x}}`, whose default text plus the next literal `}` forms `${A:-x}`, now leaks the variable to the server. Fix: widen the trigger to `\$(?=\{\w+(?:\}\|:-))`. Then re-run the AVAR-05 partial-trigger analysis (`PARTIAL_TRIGGER_TAIL`, `MARKER_COMPLETION`) with `:-` tokens in the alphabet. | `dist/utils.js` 5.2.0 line 124 vs 7.0.0 lines 124-125; CHANGELOG 7.0.0 "Added" (#878); probe script `/tmp/claude-0/-home-user-pi-claude-marketplace/17dfd209-cde8-5cbc-b8b6-f0d7d64f2f35/scratchpad/scripts/probe-escape.mjs` |
| `${VAR:-default}` and Claude parity | -- | Same syntax as Claude's `.mcp.json` | Opportunity, not required. `domain/claude-mcp-variables.ts` resolves an unset variable's default **at install**. The adapter can now resolve it at connect time, as Claude does at server start. Deny-listed names must stay decided at install (AVAR-05). Record any change as a decision. | CHANGELOG 7.0.0 |
| Config file names and locations | `mcp-adapter.json`, `mcp.json`, `.mcp.json`, `~/.config/mcp/mcp.json`, `~/.agents/mcp.json` | Same constants | None | `config.ts` lines 16-23 (5.2.0) and 18-25 (7.0.0) |
| Loader grammar (AFILE-02/03/05) | `strip-json-comments ^5.0.3` with `{ trailingCommas: true }`; `mcpServers ?? "mcp-servers"`; `isFullDefinition` | Identical; `isFullDefinition` is byte-identical | None. `adapterKeys` gains `scriptTools` (a top-level key the adapter now owns). Unknown entry keys and top-level members are still not validated, so `_piClaudeMarketplace` and `serverChoices` stay inert. | `config.ts` `toServerEntries` (7.0.0 line 1550), adapterKeys line 1370 |
| `ServerEntry` keys | 35 keys (list in `test/bridges/mcp/adapter-entry.test.ts`) | Adds **`appendStructuredContent`** (5.4.0) and **`roots`** (5.4.0) after `openUi` | `SERVER_ENTRY_KEYS` must be refreshed. Decide whether the two keys join `CARRIED_FIELDS` in `bridges/mcp/adapter-entry.ts` (both are user choices with no Claude field, so carrying them matches AFILE-06). `OAuthConfig` is unchanged. | `types.ts` `ServerEntry` |
| Fields the bridge writes (`directTools: "search" \| true`, `toolPrefix: "mcp"`, `description`, `env`, `args`, `url`, `headers`, `oauth`, `requestTimeoutMs`) | -- | Same types and meaning | None | `types.ts` lines 481, 643 |
| Config writers (`writeProjectServerDisabledOverride`, `writeDirectToolsConfig`) | -- | Byte-identical function bodies (same md5) | None. The `mcp-override-lifecycle` comments stay true. | `config.ts` |
| `resolveCommandSecret` `!!` escape; `server-manager.js` call sites; `extractOAuthConfig` interpolations | -- | All still present. The oauth interpolation call list is identical. | The `SERVER_MANAGER_CALL_SITES`, `!!` and `OAUTH_INTERPOLATIONS` drift needles still match. Only `INTERPOLATION_PASSES[0]` fails. | `dist/server-manager.js`, `dist/utils.js` 150/203, `dist/mcp-auth-flow.js` |
| Status event (ASTAT-01) | `MCP_STATUS_EVENT = "pi-mcp-adapter/status/v1"`, `MCP_STATUS_SNAPSHOT_VERSION: 1`, seven-status union | Identical lines in `dist/types.d.ts` | None. `platform/mcp-status.ts` keeps working; update only its "5.2.0" comment. | `dist/types.d.ts` |
| Tool naming | search-mode and direct tools `mcp__<server>__<tool>` under `toolPrefix: "mcp"` | Unchanged. **Since 6.0.0** every cached tool is also a Pi **deferred** tool named `mcp__<server>__<tool>`. "Tools that already have a direct or search-mode registration keep it", so the plugin's tools keep `mcp__plugin_<p>_<s>__<tool>`. | `getAllTools()` now lists more `mcp__*` names. Assertions should name exact tools, not count them. | `docs/tools.md` "Codemode and tool_search"; `deferred-tool-surface.ts` |
| `mcp` proxy tool calls → Pi hooks | A proxy call was one `mcp` tool call | **Since 6.0.0, on Pi ≥ 0.99:** `mcp({tool,args})` runs the real tool as a **nested Pi tool call** under its registered name, so Pi `tool_call`/`tool_result` handlers see `mcp__plugin_kit_stub__echo` | Affects the hooks bridge (MEDIUM, documented but not run here). A PreToolUse matcher on the plugin's MCP prefix (`toolPrefixes` in `bridges/hooks/dispatch.ts`) now fires for proxy calls, which is closer to Claude. A match-all PreToolUse hook fires **twice** per proxy call (`mcp`, then the nested name). Claude has no `mcp` proxy, so the hooks phase needs a decision on the outer `mcp` event. | CHANGELOG 6.0.0 "Added" (#861); `docs/tools.md` lines 206, 260 |
| Lazy connect | `lifecycle ?? "lazy"` | `lifecycle ?? "lazy"` | None | `index.ts`/`server-manager.ts` |
| Removed | `mcpScript`, `settings.scriptMode`, `scriptSkill`, `jev.*` script keys (6.0.0); System One key and `settings.jev` → `settings.semanticSearch` (7.0.0) | -- | None. The extension writes none of these. | CHANGELOG 6.0.0, 7.0.0 "Breaking" |
| New side effects in a sandbox | -- | `showUpgradeNotice` writes `<agentDir>/mcp-last-seen-version.json` when `ctx.hasUI` is true, and notifies only on a version **upgrade** (a first run records the version silently). 5.4.0 appends server log messages to `~/.pi/agent/mcp.log` and sends the session directory as MCP roots. | No scenario impact in a fresh sandbox. Do not assert "no extra files" in the agent dir. | `upgrade-notice.ts`; CHANGELOG 5.4.0 |
| Peers and dependencies | peers `pi-ai ^0.84.1 … \|\| ^1.0.0`, `pi-tui *`, `typebox *`, `zod`; deps include `@typesafe-ai/sdk`, `quickjs-wasi` | Same peers; `@typesafe-ai/sdk` and `quickjs-wasi` dropped; `@modelcontextprotocol/ext-tasks ^0.2.2` | None. Works on Pi 1.4.0. | `package.json` |

**Extension files that must change:**
- `extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts`: the `TRIGGER` regex and the header comment. Re-prove `PARTIAL_TRIGGER_TAIL` and `MARKER_COMPLETION` against the `:-` pass.
- `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts`: decide whether `CARRIED_FIELDS` takes `appendStructuredContent` and `roots`.
- Comment-only "5.2.0" anchors: `bridges/mcp/adapter-doc.ts` (lines 4, 19) and `platform/mcp-status.ts` (line 40).
- `bridges/mcp/substitute.ts` and `domain/claude-mcp-variables.ts`: no forced change. Optionally keep `${NAME:-default}` as a runtime reference (needs a recorded decision).

### 2. pi-subagents 0.74.0 → 0.84.0

| Surface | Change | Impact | Source |
|---------|--------|--------|--------|
| **Host requirement** | **0.80.0:** "pi-subagents now needs Pi 1.2.0 or newer; Pi 0.86.1 and 1.0.0 are no longer supported." Peer `@earendil-works/pi-ai >=1.2.0`. | Behind the Pi peer floor raise. | CHANGELOG 0.80.0 |
| **Background (`async`) runs** | 0.78.0: `@earendil-works/chord` is required "only when the installed Pi declares it" (Pi 0.85.0-1.1.x). `src/runs/background/runner-aliases.js` now marks `@earendil-works/pi-agent-core/node` `optional: true`. Under 0.74.0 both were required, which is the spike 028 failure. | Background runs can work on Pi 1.4.0, which ships neither chord nor a `./node` export. | `runner-aliases.js` 0.74.0 vs 0.84.0; CHANGELOG 0.78.0 |
| Background children and the faux model | A background child runs in a **detached runner process** (`--mode rpc --extension <bootstrap>`) and loads the parent's *ambient* extensions unless the agent sets `extensions`. Foreground children run in-process and inherit the parent's registered providers. 0.84.0 adds a diagnostic for a child "whose provider one of your extensions registers" when that extension did not load. Agents that need pi-mcp-adapter tools **must** run `async: true`. | MEDIUM risk for the agents phase. Whether an extension passed by `--extension` on the parent's CLI counts as "ambient" is not documented. The faux extension may have to be installed where the child discovers it (sandbox agent-dir `extensions/` or settings `packages`). The child also gets its **own** faux script queue, unlike the shared in-process queue the spike saw. | `docs/agents.md` lines 454, 553; `async-execution.js` line 511; CHANGELOG 0.84.0 |
| Frontmatter keys the bridge emits (`name`, `description`, `aliases`, `model`, `tools`, `excludeTools`, `thinking`, `skills`, `skillPath`, `systemPromptMode`, `inheritProjectContext`, `inheritSkills`, nested `provenance:`) | All still read by `src/agents/agents.js` (same reference count per key in both versions) | None for emitted values | `src/agents/agents.js` |
| Frontmatter parser | Comment lines (`#...`) are skipped outside `\|`/`>` blocks. Exactly-empty lines now belong to any pending block. A quoted name list (`"read", "bash"`) is split. `tools: +name`/`-name` now fails before launch. | The bridge's `provenance:` block has no blank or `#`-leading lines, and `tools:` is an unquoted comma list, so its parse should be unchanged. `test/integration/provenance-invisibility.test.ts` re-proves this at the new floor. | `src/agents/frontmatter.js` diff; CHANGELOG 0.81.0, 0.83.0 |
| Discovery dirs | user `<agentDir>/agents/`, project `.pi/agents/` with legacy `.agents/` | Unchanged | `src/agents/agents.js` (~2187) |
| `subagent` tool and actions | `action` is a free string; `list`, `interrupt`, `stop`, `steer` and `resume` remain. 0.83.0: `interrupt` without `id` is now refused. | None for `list` or execution. | `src/extension/schemas.js` |
| RH-3 probe (`getAllTools()` has `subagent`) | The `subagent` tool is still registered (inactive behind `subagents_enable` with `toolActivation: auto`). 0.79.1 also defers `bg_wait`. | The probe holds. `platform/pi-api.ts` needs no change. | CHANGELOG 0.74.0, 0.79.1 |
| `/subagents-doctor` | Still present (`src/extension/doctor.js`) | None | -- |
| Package shape | **0.81.0** ships a `bundle/` of about 30 files. `pi.extensions` is now `./bundle/index.js`. Root `index.js` and the unbundled `src/**` remain (child processes run from `src`). | The harness must load what a user gets: resolve `pi.extensions` from the package manifest instead of hard-coding `index.js` as the spike did. `test/integration/pi-subagents-peer.ts` keeps working: `src/agents/frontmatter.js` and `src/agents/skills.js` exist with the same exports (`parseFrontmatter`, `resolveSkillsWithFallback(skillNames, primaryCwd, fallbackCwd, localSkillPaths, localBaseDir)`). | `package.json` `pi`; file listing |

**Extension files that must change:** none for behavior. Update the docs: `README.md` line 39 and `docs/` text naming 0.74.0.

### 3. Pi 1.3.0 → 1.4.0

| Surface | Finding | Source |
|---------|---------|--------|
| Extension API | `dist/core/extensions/types.d.ts` and `dist/index.d.ts` are identical. `SessionStartEvent.reason` is still `startup \| reload \| new \| resume \| fork`, `SessionCompactEvent.reason` is `manual \| threshold \| overflow`, and `SessionShutdownEvent.reason` is `quit \| reload \| new \| resume \| fork`. | `diff` of the two tarballs |
| RPC | `dist/modes/rpc/rpc-mode.js` and `rpc-types.d.ts` are identical. `get_commands` returns `{ commands: RpcSlashCommand[] }` as before. | same |
| **earendil-works/pi#10470** (RPC `new_session`/`switch_session`/`fork`/`clone` emit `session_start` twice) | **Still open, not fixed in 1.4.0.** `rpc-mode.js` still has the same 6 `rebindSession(` calls as 1.3.0. A fix is proposed on a branch (remove the redundant rebinds) but not merged. Keep the extension's SSDEDUP-01 dedup. Hook scenarios must assert one SessionStart per session id and reason, as the dedup provides. | WebFetch of the issue (LOW per seam); `rpc-mode.js` rebind count (HIGH) |
| Skills / prompt templates | `core/skills.d.ts` and `core/prompt-templates.d.ts` are identical. Skill frontmatter still has `disable-model-invocation` and no `user-invocable` (`core/skills.js` line 262). The `user-invocable: false` divergence stays licensed by a Pi capability gap. | same |
| Faux provider | `pi-ai/dist/providers/faux.d.ts` (`fauxProvider`, `fauxAssistantMessage`, `fauxToolCall`, `fauxText`, `fauxThinking`, `FauxResponseFactory`) is identical to 1.3.0. | `diff` against repo `node_modules` |
| Extension loader | 1.4.0 adds the `@earendil-works/pi-ai/models` alias and virtual module (#11156). `providers/faux` is still not aliased. | `core/extensions/virtual-modules.js` diff |
| Behavior fixes worth knowing | Resumed sessions and `/tree` now keep extension tools active unless registered `defaultActive: false` (#11062). Concurrent extension dialogs no longer replace each other. BOM-prefixed `mcp.json` now parses. | CHANGELOG 1.4.0 |

**Extension files that must change:** none. Only `package.json` (dev `^1.4.0`, peer `>=1.4.0`) and the lock.

### 4. @quintinshaw/pi-dynamic-workflows 3.14.0 → 3.15.0

| Surface | Finding | Impact | Source |
|---------|---------|--------|--------|
| Storage root (WPTH-04) | `src/workflow-paths.ts` is byte-identical: `PI_CODING_AGENT_DIR` set → `join(getAgentDir(), "workflows")`, else `~/.pi/workflows`. Saved dirs are `<root>/saved` (user) and `<root>/projects/<slug>-<sha256(cwd)[0:12]>/saved` (project). | None. Update only the "3.14.0" provenance comment in `platform/workflow-home.ts`. | `diff` of `src/workflow-paths.ts` |
| Name rules | New `PI_RESERVED_COMMAND_NAMES` (27 Pi built-ins, from the Pi 1.4.0 SDK baseline): save and rename refuse them, and registration treats them as taken. | Bridged names are `<plugin>:<name>`, which never equals a bare Pi built-in. No change. A fixture workflow must not be named `new`, `compact` or similar. | `src/command-registry.ts`, `src/saved-commands.ts` |
| Script format | Unchanged: a statement body that ends in `return`, not `export default` (spike 028, trail step 3). | Fixture rule. | -- |
| Command registration | `registerSavedWorkflow` turns each saved workflow into `/<name>`. `parseCommandArgs` parses `k=v` plus positional `_`, and `_raw`. | `get_commands` lists it. | `src/saved-commands.ts` |
| Observing a run over RPC | Unchanged from 3.14.0: the result does not come back over RPC ("no thenable send function", `src/task-panel.ts`). Read `<run>.events.jsonl` (`src/run-record-store.ts` line 222) or the `pi-dynamic-workflows:progress` custom entries. | Harness step reads the events file under the sandbox workflow root. | spike 028 Gotchas |
| Extension entry | `pi.extensions: ["extensions/workflow.ts"]`. That wrapper calls `installHostCreateAgentSession` and `installHostSessionCapture` before it re-exports `dist/pi-extension.js`. | The spike loaded `dist/pi-extension.js` directly and skipped both installs. The harness must load the manifest entry, because agent-calling workflows depend on the host session hook. | `extensions/workflow.ts` |
| Child-session extensions | `providerMiddlewareExtensions` gains `builtin:codemode`. Children still load **no** host extensions by default. | A workflow child does not see the faux provider registered by an extension, unless it inherits the shared model registry. Agent-calling workflows stay out of scope, as planned. | README diff |
| WDEP-01 probe | Still registers both `workflow` and `workflow_control` | `platform/pi-api.ts` unchanged | `src/workflow-control-tool.ts` line 93 |

**Extension files that must change:** `package.json` (new optional peer and meta), `scripts/install-test-peers.mjs` (`peerNames`), the `platform/workflow-home.ts` comment, and `docs/workflows-compatibility.md`.

### 5. Cucumber and tooling additions

None. Concretely:
- No new cucumber plugin, formatter or world library. `cucumber.json` stays as it is.
- No MCP SDK for the stub server: the spike's hand-written stdio JSON-RPC server (`stub-mcp.mjs`) answers `initialize`, `tools/list` and `tools/call`, which is all the adapter sends. Do not add `@modelcontextprotocol/*`.
- No LLM SDK and no API key: the faux provider replaces both.
- The one manifest change: `@earendil-works/pi-ai` `1.4.0` (exact) as a devDependency, for the direct `providers/faux` import.

## What the harness phase must install and load

| Process | Loads (`--extension`, in order) | Install source |
|---------|---------------------------------|----------------|
| Cucumber Pi (existing long-lived RPC Pi) | the extension (`extensions/pi-claude-marketplace/index.ts`), the faux extension (new, `features/lib/`), the probe extension (new) | repo `node_modules` (Pi 1.4.0, pi-ai 1.4.0) |
| Companion Pi (new, second RPC process) | the same three, plus each companion's **manifest** entry: `pi-subagents/bundle/index.js`, `pi-mcp-adapter/index.ts`, `@quintinshaw/pi-dynamic-workflows/extensions/workflow.ts` | `node_modules/.cache/optional-peers/node_modules` at the declared floors (`scripts/install-test-peers.mjs`) |

Resolve each companion entry from its `package.json` `pi.extensions`, never a hard-coded path. pi-subagents changed its entry in 0.81.0, and the spike's workflow entry was wrong. Keep `PI_CODING_AGENT_DIR` set in the sandbox, because the engine's storage rule needs it.

## Tests that pin old behavior (must change with the raise)

| File | What it pins | Change |
|------|--------------|--------|
| `test/integration/adapter-expansion-conformance.test.ts` | `INTERPOLATION_PASSES[0]` = ``String.raw`.replace(/\$\{(\w+)\}/g,` `` (line ~583). The adversarial alphabets include `${A:-}` and `${A:-{env}` with `EXPECTED_CHECKED_VALUES = 462_790`. | **Fails on 7.0.0**: the pass text changed, and `${A:-}` now expands. Update the needle to the 7.0.0 regex text, fix `adapter-escape.ts`, extend the alphabet with `:-` forms, and recompute the count. |
| `test/bridges/mcp/adapter-entry.test.ts` | `SERVER_ENTRY_KEYS` / `OAUTH_CONFIG_KEYS` from 5.2.0 `types.ts` (lines 14-70); asserts the peer range `">=5.2.0 <6"` (line ~1253); the `_piClaudeMarketplace` inertness facts cite 5.2.0 line numbers (lines 1227-1240) | Add `appendStructuredContent` and `roots` after `openUi`, move the range to `>=7.0.0 <8`, and re-cite the 7.0.0 line numbers (`toServerEntries` is now `config.ts` line 1550). |
| `test/architecture/peer-floor.test.ts` | Pi peer `">=1.0.0"` (FLOOR-01); `pi-subagents` `">=0.74.0"`; `pi-mcp-adapter` `">=5.2.0 <6"` (PIFL-02/03) | Move to the new ranges. Add a PIFL case for `@quintinshaw/pi-dynamic-workflows` (optional meta, never a dep or lock package, lock root mirrors it). |
| `test/e2e/pi-json-output.test.ts` + `test/e2e/pi-peer-floor/{package.json,package-lock.json}` | Installs and asserts Pi `1.0.0` as the peer floor (lines 39, 41) | Move to `1.4.0` (regenerate the fixture lock). |
| `test/integration/mcp-status-conformance.test.ts` | Channel, version and status-union lines | **Passes unchanged** on 7.0.0 (lines are identical). |
| `test/integration/mcp-override-lifecycle.test.ts` | 5.2.0 `/mcp-adapter enable` behavior (comments, lines 334, 467, 853) | Behavior unchanged (writers identical); update the comments. |
| `test/integration/skill-path-resolution.test.ts`, `provenance-invisibility.test.ts` | pi-subagents `src/agents/{skills,frontmatter}.js` | Modules and exports are still present at 0.84.0. Expected to pass; this run proves it. |
| `test/integration/mcp-variable-expansion.test.ts` | Runs the adapter's own `interpolateEnvVars` | Re-run on 7.0.0. Any case with a literal `:-` changes result. |
| `test/live-uat/README.md`, `mcp-adapter-canary.mjs`, `workflow-storage-canary.mjs` | Operator-run canaries at 5.2.0 and 3.14.0 | Re-run and re-record at 7.0.0 and 3.15.0 (not gated). |
| Docs | `README.md` lines 39-40; `docs/mcp-compatibility.md` lines 11, 306, 435; `docs/env-vars.md` line 164; `docs/workflows-compatibility.md` lines 12, 191-238; `AGENTS.md` line 55; `.planning/codebase/STACK.md` lines 32-35 | Version text. |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Pi peer `>=1.4.0` | Keep `>=1.0.0` (the extension's own API needs only 1.0) | Only if the user values supporting Pi 1.0-1.3 users who never install pi-subagents. The cucumber suite proves only 1.4.0, and pi-subagents ≥ 0.80 refuses Pi < 1.2.0. |
| pi-mcp-adapter `>=7.0.0 <8` | `>=7.0.0` uncapped | Never. 7.0.0 shows that a major can change the interpolation passes the AVAR-03 escape depends on. |
| `@earendil-works/pi-ai` exact devDependency | Rely on the hoisted transitive copy | Acceptable short-term (fallow's `production.deadCode` does not scan `features/`), but fragile when Pi and pi-ai patch versions drift. |
| Hand-written stdio stub MCP server | `@modelcontextprotocol/sdk` server | Only if a scenario needs MCP features the stub cannot fake (tasks, sampling, elicitation). None are planned. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any companion (`pi-mcp-adapter`, `pi-subagents`, `@quintinshaw/pi-dynamic-workflows`) in `dependencies`, `devDependencies` or the lockfile | PIFL-03; `test/architecture/peer-floor.test.ts` fails | `scripts/install-test-peers.mjs` cache |
| `pi-subagents@0.74.0` with background runs | Requires `@earendil-works/chord` and `pi-agent-core/node`, which Pi 1.x does not ship | 0.84.0 |
| Loading `dist/pi-extension.js` of the workflow engine, or `pi-subagents/index.js` | Skips the host-session install / is not the published entry | The `pi.extensions` manifest entry |
| A real or authenticated LLM provider | Out of scope this milestone | `fauxProvider()` |
| `@earendil-works/pi-ai` with a `^` range | Can install a second copy beside Pi's exact pin | Exact `1.4.0`, moved in lockstep with Pi |
| Asserting `getAllTools()` counts | Adapter ≥ 6.0.0 registers deferred `mcp__*` tools for every cached tool | Assert specific names |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `pi-subagents@0.84.0` | Pi ≥ 1.2.0 (`pi-ai >=1.2.0`) | Background runner on Pi 1.4.0: chord not required, `pi-agent-core/node` optional |
| `pi-mcp-adapter@7.0.0` | `pi-ai ^0.84.1 … \|\| ^1.0.0` | Deferred tools and nested proxy calls need Pi ≥ 0.99; lazy connect of codemode-named servers needs Pi ≥ 1.2 |
| `@quintinshaw/pi-dynamic-workflows@3.15.0` | `pi-coding-agent >=0.80.8`, `pi-tui >=0.80.6` | Reserved-name set taken from the Pi 1.4.0 SDK |
| `@earendil-works/pi-coding-agent@1.4.0` | pins `pi-ai`, `pi-agent-core`, `pi-tui`, `pi-mcp`, `pi-codemode` at exactly `1.4.0` | Pin the repo's `pi-ai` and `pi-tui` dev deps to match |

## Sources

- npm registry `npm view <pkg> time / dist-tags` (2026-10-31): pi-mcp-adapter latest 7.0.0; pi-subagents latest 0.84.0; @quintinshaw/pi-dynamic-workflows latest 3.15.0; @earendil-works/{pi-coding-agent,pi-ai,pi-agent-core,pi-tui} latest 1.4.0; @cucumber/cucumber latest 13.3.0. HIGH.
- Tarballs unpacked under `/tmp/claude-0/-home-user-pi-claude-marketplace/17dfd209-cde8-5cbc-b8b6-f0d7d64f2f35/scratchpad/pkgs/`: pi-mcp-adapter 5.2.0, 6.0.0 and 7.0.0 (`CHANGELOG.md`, `types.ts`, `config.ts`, `dist/utils.js`, `dist/types.d.ts`, `docs/tools.md`, `upgrade-notice.ts`); pi-subagents 0.74.0 and 0.84.0 (`CHANGELOG.md`, `src/agents/{frontmatter,skills,agents}.js`, `src/runs/background/runner-aliases.js`, `docs/agents.md`); pi-dynamic-workflows 3.14.0 and 3.15.0 (`src/workflow-paths.ts`, `src/command-registry.ts`, `src/saved-commands.ts`, `extensions/workflow.ts`, README); pi-coding-agent 1.3.0 and 1.4.0 (`CHANGELOG.md`, `dist/core/extensions/types.d.ts`, `dist/modes/rpc/*`, `dist/core/{skills,prompt-templates}.d.ts`, `virtual-modules.js`); pi-ai 1.4.0 (`dist/providers/faux.d.ts`). Primary source, HIGH.
- Escape probe: `/tmp/claude-0/-home-user-pi-claude-marketplace/17dfd209-cde8-5cbc-b8b6-f0d7d64f2f35/scratchpad/scripts/probe-escape.mjs` (the repo's `serializeLiteral` against each adapter's extracted `interpolateEnvVars`). HIGH.
- https://github.com/earendil-works/pi/issues/10470 (open; fix proposed, not merged). Fetched with WebFetch (the classify seam rates it LOW); confirmed by the unchanged `rpc-mode.js` in 1.4.0.
- Spike 028 README and scripts (`.planning/spikes/028-model-free-harness/`).
