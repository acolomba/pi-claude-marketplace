# Phase 3: Claude Code tool names and tool search - Research

**Researched:** 2026-10-06
**Domain:** Plugin MCP entry translation for pi-mcp-adapter 5 on Pi 1.0 (names, tool search, closed field translation, partial availability, hook/agent name mapping)
**Confidence:** HIGH for the measurement, adapter, Pi and pi-subagents facts (run live or read from the installed packages this session). MEDIUM-HIGH for the Claude Code 2.1.291 facts (binary grep plus official docs). MEDIUM for the design recommendations.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Decision IDs are milestone-scoped and collide with older IDs already cited in
source; source comments cite requirement IDs (ANAME-0N), never `D-03-NN`.

#### Locked by requirements (recorded, not re-discussed)
- **D-03-01:** Server key `plugin_<plugin>_<server>_`, built by Claude's
  normalization (every character outside `[A-Za-z0-9_-]` becomes `_`) from
  `plugin:<plugin>:<server>`, with `toolPrefix: "mcp"` pinned on the entry.
  One name builder in `domain/` produces every generated server name (ANAME-01).
- **D-03-02:** `directTools: "search"` on every entry; a server with
  `alwaysLoad: true` gets `directTools: true` (ANAME-04). `lifecycle` is never
  written; the divergence from Claude's session-long connection is documented
  in this phase (ANAME-05). `directTools` and `toolPrefix` stay owned by this
  extension and are always rewritten (D-02-06).
- **D-03-03:** The tool-name length Pi 1.0 accepts is measured with a long
  fixture in a sandboxed real Pi 1.0 run during research, before planning
  (ANAME-03). If the measurement shows no effective limit, the length check is
  dropped and the measurement is recorded.

#### Plugin values vs user overrides (resolves the D-02-06 / D-02-22 hand-off)
- **D-03-04:** A carried field (D-02-06 set) that the plugin's translated entry
  sets belongs to the plugin: on update and reinstall the new manifest value is
  written and carry-forward skips that field. A user override survives only for
  carried fields the plugin leaves unset (as `disabled` does). Under D-03-07 the
  only such field today is `requestTimeoutMs`. Matches Claude Code, where a user
  cannot override a plugin server's timeout at all. Amends D-02-06.
  — **Reversibility:** costly — changes which user choices survive updates.
- **D-03-05:** Write-back (uninstall, disable, prune, every unstage) restores,
  for a carried field the plugin set, the kept stub's own value, not the live
  value. The marker records only the names of the carried fields the plugin set
  (no values), because uninstall can run after the plugin source is gone. Other
  carried fields keep the D-02-22/D-02-23 live-value rule. Amends D-02-23.
- **D-03-06:** At install, a kept stub's value for a plugin-set carried field
  stops applying, so it joins the D-02-21 "fields that stop applying" warning.

#### Closed translation (ANAME-06, ANAME-07)
- **D-03-07:** The translator is closed. A written entry holds only adapter
  fields mapped from Claude's server schema (2.1.291: stdio `command`, `args`,
  `env`, `timeout`, `alwaysLoad`; remote `url`, `headers`, `oauth{clientId,
  callbackPort, authServerMetadataUrl, scopes}`, `timeout`,
  `request_timeout_ms` folded into `timeout` as Claude does, `type` incl.
  `sse` -> `httpTransport: "sse"`), plus the fields this extension owns
  (`directTools`, `toolPrefix`, `description`), carried user fields and the
  marker. Every other key the plugin declares is dropped. This replaces today's
  whole-entry pass-through, which let a plugin set adapter-only powers Claude
  never grants (`approveTools`, `requestHeadersCommand`, `inheritEnv`, `auth`,
  `cwd`, `lifecycle`). — **Reversibility:** costly — it is the entry shape
  Phase 5 migrates into; changing it again re-keys approvals.
- **D-03-08:** Keys Claude itself ignores (`cwd`, adapter-only fields, any
  unknown key) are dropped silently, as Claude drops them.
- **D-03-09:** `description` is the plugin's `plugin.json` description,
  falling back to the marketplace entry's description, omitted when neither
  exists. (Claude's server schema has no `description`.)

#### Unsupported MCP features -> partial install (amends ANAME-03, ANAME-07)
- **D-03-10:** A Claude MCP feature the adapter cannot honor follows the house
  partial-install pattern, never "install and warn". Features: a `ws`
  transport, `headersHelper`, `oauth.xaa`, per-tool permission policies
  (`tools[].permission_policy`, `toolPermissions`), and any other field Claude
  honors with no adapter equivalent found by research; plus a server whose
  prefix `mcp__plugin_<p>_<s>__` alone reaches the measured length limit (no
  tool name can fit). The resolver marks the plugin `partially-available` with
  one aggregate reason `{unsupported mcp}` (closed-catalog amendment, parallel
  to `{unsupported hooks}`). A normal install refuses with the `--partial`
  hint. `--partial` installs everything except the affected servers (the whole
  server is left out, like unsupportable hook handlers); the record derives
  `partially-installed`. `info` names each affected server and the feature
  that blocks it. REQUIREMENTS.md ANAME-03/ANAME-07 and ROADMAP Phase 3
  criteria 3 and 5 are amended with this context.
  — **Reversibility:** costly — new catalog token and states pinned by gates.
- **D-03-11:** No "little room left" length warning: a prefix that leaves any
  room installs normally.

#### Name clashes (ANAME-03)
- **D-03-12:** Two servers of one plugin that normalize to the same key refuse
  the install before any write, with a typed error naming both servers and the
  key (same handling as a cross-plugin collision, D-02-03).
- **D-03-13:** Keys that differ only by `-` versus `_` share one Pi
  deferred-tool namespace (`mcp__` + key with `-` folded). The collision walk
  compares keys with `-` folded to `_` and refuses exactly as for an equal key,
  within a plugin, across plugins and against user servers. Claude keeps `-`,
  so this is a Pi-only refusal (license: Pi capability gap).

#### Hooks and agent tools (ANAME-02)
- **D-03-14:** Hook matchers accept exactly the form `mcp__<segment>__.*` as a
  server-prefix match on `mcp__<segment>__`, implemented as a string prefix
  test with no regex engine; every other regex matcher stays dropped
  (MATCH-02). Literal `mcp__<server>__<tool>` matchers and the `if:` forms
  already pass through and need proof against delivered names, not new code.
- **D-03-15:** Agent `tools:` (and `disallowedTools:` where pi-subagents
  supports it) map only names whose server is one this plugin actually writes:
  `mcp__plugin_<p>_<s>__<tool>` -> `mcp:plugin_<p>_<s>_/<tool>`, and
  `mcp__plugin_<p>_<s>` or `mcp__plugin_<p>_<s>__*` -> `mcp:plugin_<p>_<s>_`.
  Every other `mcp__` name keeps today's drop warning. Servers left out by
  D-03-10 are not mapped.

#### Shown name
- **D-03-16:** `info` and the plugin rows show a plugin MCP server as Claude
  names it, `plugin:<plugin>:<server>`. Consistency with servers installed in
  Pi directly is not a goal. The adapter key stays internal and is derived by
  the name builder wherever needed (entry write, Phase 6 status join); the
  record may keep declared names (planner's choice, weigh the Phase 5 rename
  map). Skills need no rewrite: they name tools, which ANAME-01 delivers
  exactly.

### Claude's Discretion
- Module layout of the translator (extend `bridges/mcp/adapter-entry.ts` or
  split a pure translation module), staying under fallow and sonarjs ceilings.
- Exact `info` breakdown wording for `{unsupported mcp}` and the marker field
  name for D-03-05, as closed-catalog amendments in `docs/output-catalog.md`.
- Where the lifecycle divergence (ANAME-05) is documented in this phase.

### Deferred Ideas (OUT OF SCOPE)
- Map agent `tools:` names of a dependency plugin's MCP servers (beyond ANAME-02).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANAME-01 | Tools reach the model as `mcp__plugin_<plugin>_<server>__<tool>` via key `plugin_<plugin>_<server>_` + `toolPrefix: "mcp"` | Live run A: Pi 1.0 + adapter 5.0.0 sent `mcp__plugin_measure-plugin_fixture__echo` for key `plugin_measure-plugin_fixture_`. Adapter `formatToolName`/`getServerPrefix` (types.ts:871-898) and `resolveToolPrefix` (types.ts:901) confirm the per-entry prefix beats the global setting. See "Measurement record" and "Name builder". |
| ANAME-02 | Hook matchers, `if:` and agent `tools:` in Claude form match delivered tools | Hook dispatch compares Pi's `event.toolName`, which for a direct/deferred adapter tool is the full Claude-form name (run D called the tool by that name). `if:` literal/prefix forms already handle it (if-field/index.ts:178-221, 276). D-03-14 seam: matcher.ts + dispatch.ts switch. D-03-15 seam: convert.ts `mapTools`; pi-subagents 0.74.0 token semantics read from source. Proxy-call gap documented. |
| ANAME-03 | Normalized-key collisions (incl. `-`/`_`) refused; length arm per measurement | Pi 1.0 accepts any length (runs A/D: 64, 65, 80 and 136 chars sent and executed). Per D-03-03 the length check is dropped (see Open Question 1). Collision seams: `stage.ts::assertNoMcpCollisions`, `collision-slots.ts::walkMcpSources`; the adapter itself treats `-`/`_` as one namespace (config.ts:558-576). |
| ANAME-04 | `directTools: "search"`; `alwaysLoad: true` -> `directTools: true` | Run B: search-mode tools are hidden until `mcp({search})` activates them, then declared with full names. Run E: in default Pi 1.0 + adapter 5 Pi's own `tool_search` is NOT active; it needs `defaultTools: ["+tool_search"]` (run C5). |
| ANAME-05 | `lifecycle` unset; divergence documented | Claude connects plugin servers in the background at session start and keeps them; adapter default `lazy` with idle shutdown. Recommended doc home: new `docs/mcp-compatibility.md` (see "ANAME-05 documentation home"). |
| ANAME-06 | `description` from plugin manifest on the entry | Adapter uses entry `description` for the deferred namespace (index.ts:441-449) that Pi's `tool_search` indexes (tool-search/tool.js `createToolSearchDocument`) and for `mcp({search})` ranking. Description source needs a resolver field (see "description plumbing"). |
| ANAME-07 | Closed Claude -> adapter translation; unsupported features -> `{unsupported mcp}` partial | Full field table from the 2.1.291 zod schemas; `timeout` semantics, `request_timeout_ms` cap 300000, OAuth redirect URI form `http://localhost:<port>/callback`. Partial seam mirrors `{unsupported hooks}`: `hooks-resolution.ts:144-149`, `plugin-resolver.ts:660` (`decideResolution`), `probe-classifiers.ts::kindToReason`. |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Upstream parity is the default; a divergence needs a recorded decision ID or a Pi capability gap. Research upstream with `skills/claude-code-compat-research`.
- TypeScript strict; resolver keeps the discriminated `installable: true | false` (NFR-7).
- All disk mutations atomic (NFR-1); `/reload` suffices (NFR-2); idempotent or fail-clean (NFR-3).
- Network: `list`, `info`, `uninstall`, `marketplace remove`, path-source ops must not touch the network (NFR-5). Nothing in this phase needs the network.
- Containment: writes only under `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, `<scopeRoot>/mcp-adapter.json`, `<scopeRoot>/mcp.json` (NFR-10). Never touch adapter cache, keyring or approval files.
- `npm run check` must stay green: typecheck, ESLint (`--max-warnings 0`, sonarjs cognitive 15), fallow (dead code, health cognitive 15 / cyclomatic 20, dupes, boundaries, rule pack), Prettier, source/test pairing, unit + integration tests, 100% direct coverage per source-test pair (NFR-6).
- All user output through `ctx.ui.notify` via `shared/notification-dispatch.ts` (IL-2); notify is a dumb renderer; commands stamp severity and reasons.
- New user-visible tokens are closed-catalog amendments in `docs/output-catalog.md`, pinned by `tests/architecture/compat-01-no-expansion.test.ts`, `notify-closed-set-locks.test.ts` (Reason count 65 today), and the catalog byte-equality gate `tests/architecture/catalog-uat/catalog-contract.test.ts`.
- Typed errors in `shared/errors*.ts`, `extends Error`, `this.name`, `instanceof` discrimination.
- Dependency injection over test-only seams; no `_setXForTest`.
- Comments cite requirement IDs (ANAME-0N), never `D-03-NN`, phase, plan or wave numbers.
- Every new `extensions/**` module needs a paired test (`test:corresponding`).
- Git: never commit to `main`; Conventional Commits; run `SKIP=npm-check pre-commit run --files <files>` before commit; never `--no-verify`.
- Read `skills/typescript-google-style-review/SKILL.md`, `skills/typescript-comments/SKILL.md`, `skills/typescript-unit-testing/SKILL.md` before editing `.ts`; `skills/local-verification/SKILL.md` for check scheduling.

## Summary

The measurement the roadmap required is done, and it changes one locked arm. In a sandboxed real run (Pi 1.0.0, pi-mcp-adapter 5.0.0, a keyless OpenAI-compatible stub that logs the outgoing tool list), Pi registered, declared and executed MCP tools named with 64, 65, 80 and 136 characters. Pi neither truncates, hashes nor rejects extension tool names; it sends them verbatim to the provider (pi-ai `convertTools` uses `tool.name` as is). The only limits are provider-side: OpenAI's function name maximum is 64 (official SDK doc comment), and Anthropic's Messages API now accepts `^[a-zA-Z0-9_-]{1,128}$` (official docs). Under D-03-03 ("If the measurement shows no effective limit, the length check is dropped"), the length arm of D-03-10 should be dropped and the provider caveat documented. Because the user wrote D-03-10 with a length arm, this is surfaced as Open Question 1 rather than decided here.

The same runs confirmed the naming design end to end: key `plugin_<p>_<s>_` with `toolPrefix: "mcp"` yields exactly `mcp__plugin_<p>_<s>__<tool>`; the adapter ignores extra marker content (`pluginSetFields`, `keptOverride`). Search-mode (`directTools: "search"`) tools are absent from the first request and appear only after activation. A key finding for ANAME-04's wording: in a default Pi 1.0 + adapter 5 setup, Pi's own `tool_search` is **not active** (it is registered `defaultActive: false`, and the built-in MCP extension that would turn it on is disabled by the adapter). The model reaches plugin tools through the adapter's `mcp({ search })` proxy, which activates the matching Pi deferred tools; Pi's `tool_search` works only after the user adds `"defaultTools": ["+tool_search"]`. Calls made through the `mcp` proxy reach hooks as tool `mcp`, so plugin hook matchers do not see them.

The Claude Code 2.1.291 binary settles the translation table: the server schemas are zod `object`s (strip mode), so unknown keys are dropped, matching D-03-08; `timeout` is a per-tool-call wall-clock limit in milliseconds, ignored below 1000; `request_timeout_ms` folds into `timeout` as `Math.min(request_timeout_ms, 300000)` for http/sse only; `oauth.callbackPort` becomes the redirect URI `http://localhost:<port>/callback` (not `127.0.0.1`, which is the adapter's own Pi-format translation). The partial-install seam is a near copy of `{unsupported hooks}`: a typed resolver `unsupported` kind plus a dropped-server list, a `kindToReason` arm, one new closed-set Reason, and an `info` breakdown.

**Primary recommendation:** Put the closed field table and the unsupported-feature classifier in one pure `domain/` module (shared by resolver and bridge), the key builder in `domain/name.ts`, and keep the bridge translator in `bridges/mcp/adapter-entry.ts`; keep declared server names in `record.resources.mcpServers` and derive keys everywhere with the builder.

## Measurement record (D-03-03 / ANAME-03)

**Question.** What tool-name length does Pi 1.0 accept for an extension-registered (pi-mcp-adapter) tool, and what happens past it?

**Setup (isolation established).**
- Pi: repo `node_modules/@earendil-works/pi-coding-agent` 1.0.0 (`dist/cli.js`), Node v26.10.0. [VERIFIED: package.json version read]
- pi-mcp-adapter 5.0.0 and pi-subagents 0.74.0 installed with `npm install --prefix ~/.cache/pi-cm-phase3-research/rt --legacy-peer-deps --save-exact --no-audit --no-fund pi-mcp-adapter@5.0.0 pi-subagents@0.74.0` (outside the repository). [VERIFIED: installed package.json versions]
- Each run: fresh `PI_CODING_AGENT_DIR=~/.cache/pi-cm-phase3-research/runs/<name>/agent`, `TMPDIR` under the run dir (not `/tmp`), cwd a fresh empty project dir, `--no-session --offline -p`, stdin `/dev/null`. `~/.config/mcp` and `~/.agents/mcp*` do not exist on this machine, so no other adapter source contributed. The real `~/.pi/agent` was never used; the adapter's `-builtin:mcp` write landed in the sandbox `settings.json`.
- Provider: scripted keyless OpenAI-compatible stub on `127.0.0.1` (sandbox `models.json` `{"providers":{"stubllm":{"baseUrl":"http://127.0.0.1:<port>/v1","api":"openai-completions","apiKey":"stub","models":[{"id":"stub"}]}}}`), logging each request's `tools[].function.name`. Scripted steps let it emit a tool call.
- Fixture: a dependency-free stdio MCP server (JSON-RPC over newline-delimited stdio) exposing tools `echo`, `a×28`, `b×29`, `c×44`, `d×100`.
- Entry in sandbox `mcp-adapter.json`: key `plugin_measure-plugin_fixture_`, `"toolPrefix":"mcp"`, `"directTools": true | "search"`, `"description"`, and a marker `"_piClaudeMarketplace":{"plugin":"measure-plugin","marketplace":"m","pluginSetFields":["timeout"],"keptOverride":{"disabled":true}}`.
- Command shape: `PI_CODING_AGENT_DIR=$R/agent timeout 90 node <repo>/node_modules/@earendil-works/pi-coding-agent/dist/cli.js -p --no-session --offline --no-extensions -e <prefix>/node_modules/pi-mcp-adapter/index.ts [extra args] "use the zebra quartz tool"`.

**Runs and decisive output.**

| Run | Variant | Exit | Decisive output |
|-----|---------|------|-----------------|
| A | `directTools: true` | 0 | Request 0 tools: `read, bash, edit, write, mcp, mcp__plugin_measure-plugin_fixture__echo, …`; stub length log `["mcp__plugin_measure-plugin_fixture__aaaaaaaaaaaaaaaaaaaaaaaaaaaa",64]`, `[…bbbb…,65]`, `[…cccc…,80]`, `[…dddd…,136]`. stderr only: `Turned off Pi's built-in MCP so it doesn't run next to pi-mcp-adapter.` |
| D | `directTools: true`, stub calls the 136-char tool | 0 | Request 1 last message `{"role":"tool","content":"called dddd…d","tool_call_id":"call_1"}`; fixture log `{"method":"tools/call","params":"dddd…d"}`; stdout `done`. |
| B | `directTools: "search"`, stub calls `mcp({search:"zebra quartz"})` | 0 | Request 0 tools: `read, bash, edit, write, mcp` (no plugin tools). Request 1 tools add all five `mcp__plugin_measure-plugin_fixture__…` names; tool result begins `Activated as direct tools: mcp__plugin_measure-plugin_fixture__aaaa…`. |
| C | search + `-e builtin:tool-search` | 0 | Request 0 tools: `read, bash, edit, write, mcp` — `tool_search` loaded but not active. |
| C5 | search + `-e builtin:tool-search` + sandbox setting `"defaultTools":["+tool_search"]` + seeded `mcp-cache.json`; stub calls `tool_search` | 0 | Request 0 tools include `tool_search`; result `Loaded 5 tools. They are available from your next call: - mcp__plugin_measure-plugin_fixture__echo: …`; request 1 declares all five. |
| C2/C4 | search + `--tools read,bash,edit,write,tool_search` | 0 | `tool_search` result `No matching tools found.` (the `--tools` allowlist also left the adapter's `mcp` tool inactive). Not used for conclusions. |
| E | search, **without** `--no-extensions` (all built-ins load) | 0 | Request 0 tools: `read, bash, edit, write, mcp`. stderr: `Extension package "builtin:mcp": … registers command /mcp, so built-in extension mcp was not loaded.` Sandbox settings gained `"extensions": ["-builtin:mcp"]`. |

**Conclusions.**
1. Pi 1.0 + adapter 5.0.0 impose **no tool-name length limit**: names of 64-136 characters are registered, declared to the provider and executed. [VERIFIED: runs A, D]
2. Code confirms there is no check: Pi's `registerTool` validates only the parameter schema (`dist/core/extensions/loader.js:231-240`); pi-ai sends `name: tool.name` unchanged for OpenAI (`openai-completions.js` `convertTools`) and Anthropic (`anthropic-messages.js` `name: isOAuthToken ? toClaudeCodeName(tool.name) : tool.name`). Only Pi's **built-in** MCP hashes names above 64 (`dist/extensions/mcp/tools.js:30`, `const MAX_TOOL_NAME_LENGTH = 64;`, and `createMcpToolName` at :49), and the adapter disables the built-in. [VERIFIED: source read]
3. Provider limits (not Pi): OpenAI function names "Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 64." [CITED: github.com/openai/openai-node src/resources/shared.ts `FunctionDefinition.name`]. Anthropic: "Must match the regex `^[a-zA-Z0-9_-]{1,128}$`." [CITED: platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools]. A name over the active provider's limit would be rejected by that provider with a 400; with Anthropic native tool changes, Pi keeps every activated tool declared for the rest of the session (anthropic-messages.js comment: "the request-level list therefore only grows"), so one over-long activated tool would fail every later request in that session. This was not run against a real provider (no credentials used) — [ASSUMED] for the exact failure mode.
4. Upstream parity: Claude Code builds `mcp__<server>__<tool>` without truncating or hashing and documents "the 64-character limit applies to the name as sent" only for a permission-policy field; no install-time check exists upstream (CONTEXT compat evidence, medium confidence).
5. Search-mode exposure: plugin tools are hidden until activated, then declared under their full names. [VERIFIED: run B]

**Isolation note.** The adapter's first start wrote `"-builtin:mcp"` and `mcp-onboarding.json` into each sandbox agent dir only. Scratch lives at `~/.cache/pi-cm-phase3-research/` (`bin/run.sh`, `bin/stub.mjs`, `bin/fixture-mcp.mjs`, `rt/` with the pinned companions), reusable for the Phase 7 live UAT.

## Upstream evidence records (Claude Code 2.1.291)

Binary: `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.291/claude`, grepped 2026-10-06 with `LC_ALL=C /usr/bin/grep -oa`.

**E1. Server schemas (union `pY`).** `pY=f(()=>Fe([Xqe(),iAt(),Bu(),Wu(),rot(),u8t(),Vio(),Kio()]))` = stdio, sse, sse-ide, ws-ide, http, ws, sdk, claudeai-proxy. Verbatim fragments:
- stdio: `Xqe=f(()=>u({type:R("stdio").optional(),command:o().min(1,"Command cannot be empty"),args:C(o()).default([]),env:pe(o(),o()).optional(),timeout:ot().optional(),alwaysLoad:M().optional(),bareElicitationCapability:M().optional(),role:ht()}))`
- oauth: `Cr=f(()=>u({clientId:o().optional(),callbackPort:E().int().positive().optional(),authServerMetadataUrl:o().url().startsWith("https://",{message:"authServerMetadataUrl must use https://"}).optional(),scopes:o().min(1).optional(),xaa:$u().optional()}))`
- per-tool policy: `vr=f(()=>u({name:o(),permission_policy:z(["always_allow","always_ask","always_deny"]).optional()}))`; `oot=f(()=>z(["allow","ask","blocked"]))`
- sse: `iAt=f(()=>u({type:R("sse"),url:o(),headers:pe(o(),o()).optional(),headersHelper:o().optional(),oauth:Cr().optional(),timeout:ot().optional(),request_timeout_ms:Or(),tools:C(vr()).optional(),alwaysLoad:M().optional(),bareElicitationCapability:M().optional(),discoveryCache:M().optional(),role:ht(),toolPermissions:pe(o(),oot()).optional()}).transform(ofr))`
- http: `rot=f(()=>u({type:z(["http","streamable-http"]).transform(()=>"http"),url:o(),headers:…,headersHelper:…,oauth:Cr().optional(),timeout:ot().optional(),request_timeout_ms:Or(),tools:C(vr()).optional(),alwaysLoad:…,bareElicitationCapability:…,discoveryCache:…,role:ht(),toolPermissions:pe(o(),oot()).optional()}).transform(ofr))`
- ws: `u8t=f(()=>u({type:R("ws"),url:o(),headers:pe(o(),o()).optional(),headersHelper:o().optional(),timeout:ot().optional(),alwaysLoad:M().optional(),bareElicitationCapability:M().optional(),role:ht()}))`
- host-only types: `function rfr(e){return e==="sdk"||e==="sse-ide"||e==="ws-ide"}`
- Confidence: HIGH (verbatim). Unresolved: whether `tools[].permission_policy` / `toolPermissions` are enforced for plugin `.mcp.json` servers (the `vr` describe text reads "Per-tool permission policy carried on mcp_set_servers for remote servers", which suggests an SDK path). D-03-10 lists them as unsupported regardless.

**E2. Unknown keys are stripped (D-03-08).** The object factory is `function u(e,t){let r={type:"object",shape:e??{},...Qa(t)};return new yTe(r)}` with siblings `ze` (`catchall:$At()`, strict) and `pt` (`catchall:ie()`, loose). `u` sets no catchall, which is zod's default strip mode. The plugin loader keeps the parsed output: `let ke=pY().safeParse(_e);if(ke.success)Y[he]=ke.data;else t(S(\`Invalid MCP server config for ${he} in ${h}: …\`),{level:"error"})`. So unknown keys (`cwd`, adapter-only fields) vanish, and a server that fails the schema is skipped with an error while the plugin's other servers load. Confidence: MEDIUM-HIGH (the `u` binding and the schema chunk were matched by name, not traced through the bundle's module boundary).

**E3. `timeout` semantics.** `function $o(e){let n=(e?.timeout!==void 0&&e.timeout>=1000?e.timeout:void 0)??a.MCP_TOOL_TIMEOUT??Mr;return Math.min(Math.max(n,1000),Qu)}` with `Qu=2147483647`. Docs: "Set a per-server tool execution timeout by adding a `timeout` field in milliseconds … The per-server `timeout` is a hard wall-clock limit per tool call, and progress notifications from the server don't extend it. Values below 1000 are ignored and fall through to `MCP_TOOL_TIMEOUT`, or to its default of about 28 hours when that variable is unset." [CITED: code.claude.com/docs/en/mcp]. Confidence HIGH.

**E4. `request_timeout_ms` fold and cap.** `Fu=300000,Or=f(()=>E().int().positive().optional().catch(void 0).describe("@internal CCR backend wire hint; folded into timeout at parse."));function ofr({request_timeout_ms:e,...n}){return{...n,...n.timeout===void 0&&e!==void 0&&{timeout:Math.min(e,Fu)}}}` — http/sse only (stdio and ws schemas have no `request_timeout_ms`); an invalid value is silently `undefined` (`.catch(void 0)`). Confidence HIGH.

**E5. OAuth redirect URI.** `function aFe(n=f){return\`http://localhost:${n}/callback\`}` and `let U=t.oauth?.callbackPort,…,M=R?0:U??await P_e(A),j=c?.redirectUri??aFe(M)`. Docs: "Use `--callback-port` to fix the port so it matches a pre-registered redirect URI of the form `http://localhost:PORT/callback`." Confidence HIGH. **This corrects the research seed** (`http://127.0.0.1:<port>/callback` is what the adapter's own Pi-format translation writes, `config.ts:1278`); a pre-registered IdP client matches the redirect string byte for byte, so the Claude form must be written. The adapter accepts `localhost` and listens on that host (`mcp-auth-flow.ts:412-440`).

**E6. Other honored fields.** `alwaysLoad`: "When true, all tools from this server are always included in the prompt and never deferred behind tool search … When false, all tools from this server are deferred behind tool search. Default: tools are deferred when tool search is enabled. As a side effect, true also blocks startup until the server is connected (capped at the standard 5s connect timeout)". `bareElicitationCapability: true` makes Claude advertise the bare elicitation capability (`!(("bareElicitationCapability"in e)&&e.bareElicitationCapability===!0)?Ufn():WFt()`); the adapter always advertises `elicitation: { form: {}, url? }` (`server-manager.ts:1409-1426`) with no per-server switch. `role` is `"@internal Coordinator-mode role"` (`R("comms").optional().catch(void 0)`). `discoveryCache` is a Claude discovery-cache hint (deleted from the config in `r1` before use); the adapter caches discovery by default. Confidence HIGH for text, MEDIUM for the effect classification.

**E7. Session lifecycle (ANAME-05).** Docs: "Other servers connect in the background by default; set `MCP_CONNECTION_NONBLOCKING=0` to make startup wait for them too." Stdio spawn: `new dt({command:H,args:ce,env:{...Ne,CLAUDE_PROJECT_DIR:be??vr(),CLAUDE_CODE_SESSION_ID:K(),CLAUDECODE:"1",...r.env,…},stderr:"pipe",...be!==null&&{cwd:be}})` (env items are Phase 4 material). Adapter: lifecycle default `lazy` (index.ts `const lifecycleMode = definition.lifecycle ?? "lazy";`), "discovered at startup and then stopped until you use them". Confidence HIGH.

**E8. Plugin tool name form.** Docs: "The full form is `mcp__plugin_<plugin-name>_<server-name>__<tool-name>`, where any character outside `A-Z`, `a-z`, `0-9`, `_`, and `-` is replaced with `_`. … `mcp__plugin_my-plugin_database-tools__query`" and "The server itself registers under the scoped name `plugin:<plugin-name>:<server-name>`". [CITED: code.claude.com/docs/en/mcp]. Confidence HIGH.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Key builder `plugin_<p>_<s>_` and display name `plugin:<p>:<s>` | `domain/name.ts` | — | D-03-01 requires one builder in `domain/`; bridges, orchestrators, info and Phase 5/6 all import it. |
| Closed Claude field table + unsupported-feature classifier | `domain/` (new pure module) | `bridges/mcp` consumes | The resolver (domain) decides `partially-available`; the bridge translates. One table prevents the two from drifting. `domain` may not import `bridges`. |
| Partial-availability verdict `{unsupported mcp}` | `domain/plugin-resolver.ts` + `domain/mcp-resolution.ts` | `shared/probe-classifiers.ts` (render mapping) | Mirrors `hooks-resolution.ts` pushing `unsupported`. |
| Entry translation, carry-forward, marker plugin-set field names | `bridges/mcp/adapter-entry.ts` | `bridges/mcp/marker.ts`, `adapter-doc.ts` | Existing home of `stampServers`, `restoredOverride`, `CARRIED_FIELDS`. |
| Collision walk (same-plugin, `-`/`_` folding) | `bridges/mcp/stage.ts` / `collision-slots.ts` | `domain/name.ts` (fold helper) | Existing refusal point before any write. |
| Hook matcher prefix form | `domain/components/hooks/matcher.ts` | `bridges/hooks/dispatch.ts` (switch arm), `domain/components/hooks/partition.ts` | Parse in domain, fire in bridge. |
| Agent `tools:` / `disallowedTools:` mapping | `bridges/agents/convert.ts` | orchestrator passes written server names | Needs the plugin's written server set; no bridge-to-bridge import (fallow zones). |
| `description` source | resolver output (domain) | install/update/reinstall orchestrators pass it to the MCP stage input | The MCP phase has no manifest today. |
| Display `plugin:<p>:<s>` in info and rows | `orchestrators/plugin/info.ts` | `shared/notification-*` (renderer stays dumb) | Orchestrator composes names; renderer prints. |
| Divergence docs (ANAME-05 etc.) | `docs/` | README name table | Docs tier. |

## Standard Stack

No new runtime or dev dependency. Everything uses existing modules: `typebox`, `write-file-atomic` (via `shared/atomic-json.ts`), `strip-json-comments` (already a runtime dependency for the JSONC reader), `node:test`.

| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| pi-mcp-adapter | 5.0.0 (optional peer, scratch only) | Consumer of the entries; research and live UAT target | Never a dependency or devDependency (PITFALLS, STACK). Tests vendor the facts they pin, with a provenance comment and a floor-tie test, as `tests/bridges/mcp/adapter-entry.test.ts` does (`SERVER_ENTRY_KEYS`, dist.shasum `6c20461d658ec7d7b7e303b067e2ff13a7846d00`). |
| pi-subagents | 0.74.0 (optional peer, scratch only) | Consumer of generated agent `tools:` | Same policy. |

## Package Legitimacy Audit

No external packages are installed by this phase. The two companions above were installed only into the out-of-repo research prefix (`~/.cache/pi-cm-phase3-research/rt`) and are already the pinned, previously audited floors from Phases 1-2.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| (none added) | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Closed translation table (D-03-07, ANAME-06, ANAME-07)

Input: one Claude server object after `${CLAUDE_*}` substitution (today's `substituteAndInject`, unchanged in this phase). Output: only the keys below plus carried user fields and the marker.

| Claude field (2.1.291) | Applies to | Adapter field (`ServerEntry`, types.ts:438) | Rule |
|---|---|---|---|
| `type` absent or `"stdio"` | stdio | — (adapter infers stdio from `command`) | Drop the key. |
| `type: "http"` / `"streamable-http"` | remote | — | Drop the key (adapter default transport). See Open Question 5 on forcing `httpTransport: "streamable-http"`. |
| `type: "sse"` | remote | `httpTransport: "sse"` | D-03-07. |
| `command` | stdio | `command` | Copy. |
| `args` | stdio | `args` | Copy (Claude defaults to `[]`). |
| `env` | stdio | `env` | Copy; today's injection of `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA`/`CLAUDE_PROJECT_DIR` stays (Phase 4 narrows). |
| `url` | remote | `url` | Copy. |
| `headers` | remote | `headers` | Copy (Phase 4 adds `!` escaping and the deny-list). |
| `timeout` (ms, int > 0) | all | `requestTimeoutMs` | Write only when ≥ 1000 (E3); below 1000 Claude ignores it, so leave it unset (plugin did not set it). |
| `request_timeout_ms` | http/sse | `requestTimeoutMs` | Only when `timeout` is absent: `Math.min(request_timeout_ms, 300000)` (E4), then the ≥ 1000 rule. Invalid value -> ignored (`.catch(void 0)`). |
| `alwaysLoad: true` | all | `directTools: true` | D-03-02. Any other value -> `directTools: "search"`. |
| `oauth.clientId` | remote | `oauth.clientId` | Copy. |
| `oauth.callbackPort` | remote | `oauth.redirectUri` | `http://localhost:<port>/callback` (E5); integer 1..65535. |
| `oauth.authServerMetadataUrl` | remote | `oauth.authServerMetadataUrl` | Copy; Claude requires `https://` (see Open Question 4 for a non-https value). |
| `oauth.scopes` | remote | `oauth.scope` | Copy the space-separated string (both sides use RFC 6749 §3.3 format). |
| — (owned) | all | `toolPrefix: "mcp"` | Always written (D-03-01). |
| — (owned) | all | `directTools` | Always written (D-03-02). |
| — (owned) | all | `description` | D-03-09; omit when absent. |

**Unsupported features -> `{unsupported mcp}` (D-03-10).** A server with any of these is left out under `--partial` and named with its feature in `info`:

| Feature | Trigger | Adapter gap |
|---|---|---|
| `ws` transport | `type: "ws"` | No WebSocket transport in `ServerEntry` (`httpTransport` is `"streamable-http" \| "sse"`). [VERIFIED: types.ts:438-525] |
| `headersHelper` | present (http/sse/ws) | `requestHeadersCommand` has a different contract (per-request JSON envelope vs. per-connection shell helper). |
| `oauth.xaa` | present and truthy | No cross-app-access flow in `OAuthConfig`. |
| `tools[].permission_policy` | any entry sets it | No per-tool policy field (`approveTools` is user-owned and different). |
| `toolPermissions` | non-empty | Same. |
| `bareElicitationCapability: true` | literal `true` | Adapter always advertises the form/url capability (E6). [Recommended inclusion under D-03-10's "any other field" clause; confirm — Open Question 3.] |
| Host-only types `sse-ide`, `ws-ide`, `sdk`, `claudeai-proxy` | `type` value | Not plugin-runnable; [ASSUMED] Claude does not run them from a plugin either. Open Question 3. |
| Length arm | prefix `mcp__plugin_<p>_<s>__` reaches the limit | **Measurement: Pi has no limit** — drop per D-03-03 (Open Question 1). |

**Dropped silently (D-03-08):** `cwd`, `role`, `discoveryCache`, every adapter-only key (`approveTools`, `requestHeadersCommand`, `inheritEnv`, `auth`, `bearerToken*`, `caFile`, `socket`, `lifecycle`, `idleTimeout`, `exposeResources`, `includeTools`, `excludeTools`, `searchKeywords`, `debug`, `trace`, `pluginDataDir`, `literalEnv`, `protocolVersion`, `tasks`, `disabled`, `description`, `directTools`, `toolPrefix`, `httpTransport`), every unknown key, and every `oauth` sub-key outside the four above (`clientSecret`, `clientMetadataUrl`, `grantType`, `authorizationParams`, `skipIssuerMetadataValidation`, `clientName`, `clientUri`, `logoUri`, `redirectUri`). Note: a plugin-declared `description`, `directTools` or `toolPrefix` is replaced by the owned value, not passed through.

## Architecture Patterns

### Data flow

```text
plugin.json / .mcp.json / entry mcpServers
        │
        ▼
domain/mcp-resolution.ts  ──►  domain/<mcp table module>.classify(server)        (pure)
        │                           │ unsupported feature per server
        │                           ▼
        │                  resolution.unsupported += "mcpServers"
        │                  resolution.droppedMcpServers = [{server, feature}]
        │                  resolution.mcpServers = supported subset
        ▼
domain/plugin-resolver.ts decideResolution ──► installable | partially-available | unavailable
        │                                         │
        │ (list/info render)                      │ normal install: requireInstallable throws
        │                                         │   PluginShapeError{partialable, unsupportedKinds}
        ▼                                         ▼ --partial: requirePartialInstallable admits
orchestrators (install-outcome / update-swap / reinstall-replace)
        │  servers = resolved.mcpServers (supported only), description, pluginName
        ▼
bridges/mcp/stage.ts prepareStageMcpServers
        │  keys = generatedMcpServerKey(plugin, declared)      (domain/name.ts)
        │  same-plugin key clash / folded clash  ──► typed error, no write
        │  assertNoMcpCollisions (folded compare across 9 sources)
        ▼
bridges/mcp/adapter-entry.ts stampServers
        │  translate(closed table) → carriedFields minus plugin-set → marker{…, pluginSet names, keptOverride}
        ▼
atomicWriteJson(<scopeRoot>/mcp-adapter.json)
        │
        ▼  /reload
pi-mcp-adapter: key + toolPrefix "mcp" → Pi deferred tools mcp__plugin_<p>_<s>__<tool>
        │ namespace mcp__<key with - folded>, description
        ▼
model: mcp({search}) activates → direct call by Claude name → Pi tool_call event → hooks bridge
```

### Recommended module layout (Claude's discretion)

```
extensions/pi-claude-marketplace/
├── domain/name.ts                    # + generatedMcpServerKey(plugin, server), + mcpServerDisplayName(plugin, server), + fold helper
├── domain/mcp-server-features.ts     # NEW pure: Claude field table, classifyMcpServer() -> unsupported feature | undefined
├── domain/mcp-resolution.ts          # calls the classifier; fills droppedMcpServers / unsupported
├── domain/resolver-types.ts          # + droppedMcpServers?, + description? on MaterializableFields
├── bridges/mcp/adapter-entry.ts      # closed translation (or split bridges/mcp/translate.ts if fallow unit size demands)
├── bridges/mcp/marker.ts             # + plugin-set carried field names (name is discretionary)
├── bridges/mcp/stage.ts              # keys via builder, D-03-12/13 checks
├── bridges/mcp/adapter-doc.ts        # restoredOverride call site reads the marker's plugin-set names
├── domain/components/hooks/matcher.ts# + mcp server-prefix kind
├── bridges/hooks/dispatch.ts         # + switch arm
├── bridges/agents/convert.ts         # + mcp__ mapping against written server set
├── shared/probe-classifiers.ts       # kindToReason "mcpServers" -> "unsupported mcp"
├── shared/notification-types.ts      # Reason += "unsupported mcp"; components.mcp entry shape
└── orchestrators/plugin/info.ts      # plugin:<p>:<s> display + per-server feature breakdown
docs/mcp-compatibility.md             # NEW: naming, tool search, lifecycle (ANAME-05), proxy/hook gap, timeout, unsupported features
```

Every new `extensions/**` module needs its paired `tests/**` file. A new `domain/` module that names no git surface is gated by ESLint BLOCK F automatically (default-deny), which is fine.

### Pattern 1: One key builder, one display builder (ANAME-01, D-03-16)

Current in-repo convention (`domain/name.ts`): builders call `assertSafeName` on inputs and output, e.g. `generatedAgentName` (lines 182-188):

```typescript
export function generatedAgentName(plugin: string, source: string): string {
  assertSafeName(plugin);
  assertSafeName(source);
  const generated = `pi-claude-marketplace-${plugin}-${source}`;
  assertSafeName(generated);
  return generated;
}
```
[VERIFIED: domain/name.ts:183-189]

The MCP key builder follows Claude's `Cn` exactly (E8): `("plugin:" + plugin + ":" + server).replace(/[^A-Za-z0-9_-]/g, "_") + "_"`. The trailing `_` makes the adapter's `getServerPrefix("…_", "mcp")` + `"_"` + tool equal Claude's `"__"` separator (adapter types.ts:871-898; verified live in run A). The fold for D-03-13 is `key.replace(/-/g, "_")`, the same transform the adapter applies to the deferred namespace (`name: \`mcp__${spec.serverName.replace(/-/g, "_")}\``, index.ts:445) and to its own claudePlugins shadowing check (`formatServerNamespace`, config.ts:558-576). An architecture gate forbidding a second copy of the normalization regex is cheap insurance (PITFALLS Pitfall 9) but optional.

### Pattern 2: Plugin-set carried fields (D-03-04/05/06)

The carried set today:

```typescript
const CARRIED_FIELDS = [
  "disabled",
  "approveTools",
  "includeTools",
  "excludeTools",
  "lifecycle",
  "idleTimeout",
  "requestTimeoutMs",
  "debug",
  "searchKeywords",
] as const;
```
[VERIFIED: bridges/mcp/adapter-entry.ts:19-29]

Rules derived from the decisions:
1. `pluginSet = keys(translated) ∩ CARRIED_FIELDS` — today only `requestTimeoutMs` can appear.
2. Stamp: `{ ...translated, ...carriedFields(previous) minus (pluginSet ∪ previousMarker.pluginSet), marker: { plugin, marketplace, <pluginSet names when non-empty>, keptOverride? } }`. Excluding the **previous** marker's plugin-set names matters: if the old manifest set a timeout and the new one drops it, the old plugin value must not survive as if it were the user's.
3. `restoredOverride(kept, live)`: for a carried field in `kept`, if `live`'s marker lists it as plugin-set, restore `kept[field]`; otherwise keep the D-02-22/23 live-value rule. `live` already carries the marker, so no new parameter is needed at the `adapter-doc.ts::survivingEntry` call site.
4. Install warning: `inactiveOverrideFields(overlay)` must also return the overlay's carried fields that are in `pluginSet` (D-03-06); it then needs the per-server plugin-set names (signature change at `stage.ts::overrideKeptNotices`).
5. Marker key stays `_piClaudeMarketplace` (`export const CLAUDE_MARKETPLACE_MARKER_KEY = "_piClaudeMarketplace";`, marker.ts:15) [VERIFIED]; `readMarker` must parse the new optional array the same tolerant way it parses `keptOverride`.

The adapter ignores marker content (run A loaded an entry whose marker held `pluginSetFields` and `keptOverride`; Phase 2's 02-10 proof covered `keptOverride` at code level). The project-approval hash covers the whole entry including the marker (02-10-SUMMARY: "APPROVAL_HASH_COVERS_MARKER=true"), so marker content must stay byte-stable across restages.

### Pattern 3: `{unsupported mcp}` as a mirror of `{unsupported hooks}`

Existing hook path:

```typescript
function recordHooksConfig(resolution: HooksResolution, hooks: ResolvedHooksConfig): void {
  if (hooks.dropped.length > 0) {
    resolution.unsupported.push("hooks");
    resolution.droppedHooks = [...hooks.dropped];
  }
```
[VERIFIED: domain/hooks-resolution.ts:144-148]

Render mapping today:

```typescript
export type UnsupportedReason =
  "unsupported hooks" | "lsp" | "unsupported source" | "unsupported component";
```
[VERIFIED: shared/probe-classifiers.ts:76-77]; `kindToReason` maps `"lspServers"` → `"lsp"`, `"hooks"` → `"unsupported hooks"`, else `"unsupported component"` (probe-classifiers.ts:203-213).

What `{unsupported mcp}` touches:
- `domain/mcp-resolution.ts` (classify per server; keep supported servers in `mcpServers`; record `droppedMcpServers: {server, feature}[]`; push `"mcpServers"` into `unsupported` once). Recommended kind string `"mcpServers"`, on the `lspServers` precedent (plugin field name). `compatibility.unsupported` is persisted as free strings (`unsupported: Type.Array(Type.String())`, persistence/state-io.ts:135) [VERIFIED], so no new record key.
- `domain/resolver-types.ts` (`MaterializableFields` + optional `droppedMcpServers`; mirror the `DroppedHook` drift checks if the type is shared).
- `domain/plugin-resolver.ts::materializableFields` spreads the new field (line ~147 pattern); `decideResolution` (line 660) already routes `unsupported.length > 0` to `partiallyAvailable`, and `requireInstallable` (line 687) already throws `PluginShapeError{partialable: true, unsupportedKinds: r.unsupported}`; `requirePartialInstallable` (line 735) admits the arm. No change needed there.
- `shared/probe-classifiers.ts`: `UnsupportedReason` += `"unsupported mcp"`; `kindToReason("mcpServers")` arm.
- `shared/notification-types.ts`: `Reason` += `"unsupported mcp"` (append at tail; catalog order). `shared/notify-reasons.ts`: add to its private `UnsupportedReason` partition (line ~104).
- `tests/architecture/notify-closed-set-locks.test.ts`: `REASON_ENROLLMENT` += member and `assert.strictEqual(Object.keys(REASON_ENROLLMENT).length, 65);` → 66 [VERIFIED: line 196]. `tests/architecture/compat-01-no-expansion.test.ts` `EXPECTED_REASONS` += member.
- `docs/output-catalog.md`: the `(partially-available)` row (line 147), the Reasons paragraph (line 63 — it still says "46-member", stale against the gate's 65; fix while amending), a list example, an install-failure example with the `--partial` hint, and an `info` breakdown example; each new fenced block needs a catalog-uat fixture (byte-equality gate).
- `orchestrators/plugin/install.messaging.ts` and `list-flow.ts` widen their local reason unions (both name `"unsupported hooks"` explicitly, lines 264 and 575).
- `info.ts::composeResolvedComponents` lists `Object.keys(resolved.mcpServers)` today (line 1001); it must list supported servers as `plugin:<p>:<s>` and the dropped ones with their feature. `components.mcp` is `readonly string[]` now; a per-entry shape (`{ name, unsupported? }`) is what Phase 6 also needs for runtime status (ARCHITECTURE.md), so design it once here.
- `--partial`: the bridge stages only `resolved.mcpServers`, so excluding dropped servers there makes `--partial` work with no bridge change. `partially-installed` is derived from `record.compatibility.unsupported.length > 0` (`plugin-state-classifier.ts:146-153`) — no new derivation code.

### Pattern 4: Collision checks (D-03-12, D-03-13)

- Same-plugin: compute every server's key first; two declared names with one key, or with equal folded keys, throw a new typed error (e.g. `McpServerKeyCollisionError { plugin, servers: [a, b], key }`) before `readTargetConfig`. Today's `McpServerCollisionError(serverName, owningPath, winningPath)` (errors-bridges.ts:59-72) has no slot for two server names, so a sibling class is cleaner than overloading it.
- Cross-source: `assertNoMcpCollisions` looks up `walk.declarations.get(name)` by exact key (stage.ts:91). Build a folded index (`fold(name) -> declarations[]`) in `walkMcpSources` or at the check, and keep the `isOwnedBy` self-exemption. The `theirs` check against the target file must fold too.
- With the new keys, `ours`/`theirs` partition keys are adapter keys; the AS-8 noop and `recorded` logic in `prepareStageMcpServers` must use keys for the file and declared names for the record (see Pattern 6).

### Pattern 5: Hook matcher server-prefix (D-03-14)

Today:

```typescript
const SAFE_MATCHER_CHARS = /^[A-Za-z0-9_|-]+$/;
const MCP_SEGMENT = /^[A-Za-z0-9_-]+$/;
…
export type ParsedMatcher =
  | { kind: "match-all" }
  | { kind: "tool-set"; toolNames: ReadonlySet<string> }
  | { kind: "regex" }
  | { kind: "unmapped"; token: string };
```
[VERIFIED: domain/components/hooks/matcher.ts:4-5, 10-14]

`mcp__x__.*` fails `SAFE_MATCHER_CHARS` (it has `.` and `*`) and is classified `regex` today. Add a check before line 51: if `raw` starts with `mcp__`, ends with `__.*`, and the middle passes `MCP_SEGMENT`, return a prefix kind (string ops only, no regex built from input). `bridges/hooks/dispatch.ts::matcherFiresOnToolEvent` (lines 113-123) needs the new switch arm (`toolName.startsWith(prefix)`); `domain/components/hooks/partition.ts` treats the new kind as supported. The `if:` predicate already has the analogous `{ kind: "mcp-server-prefix"; serverPrefix: string }` with `startsWith` (if-field/index.ts:93-115, 207-221, 276) — reuse its split-based style. Whether the prefix form is accepted inside a pipe alternative (`mcp__x__.*|Write`) is Open Question 6.

### Pattern 6: Record names vs keys (D-03-16 planner's choice) — recommendation

Recommend **keeping declared server names** in `record.resources.mcpServers` (today's values: `StagedMcpRecord.generatedName` is documented "(== input key; no rename today)", types.ts:46) and deriving the key with the builder:
- Display is exact on both info arms (`plugin:<p>:<declared>`); keys are lossy (`plugin:a.b:c` and `plugin:a_b:c` share a key), so a key-only record could not show D-03-16 names.
- Phase 5's rename map is `declared → generatedMcpServerKey(plugin, declared)` with no `state.json` rewrite of MCP names; old legacy `mcp.json` keys ARE declared names.
- Phase 6 joins status by `generatedMcpServerKey(plugin, declared)`.
- Cost: `cascadeUnstagePlugin` sets `dropped.mcpServers = [...mcpResult.removedNames]` (orchestrators/marketplace/shared.ts:452, 499) and the record filters compare against it (`orchestrators/plugin/shared.ts:1368`, `orchestrators/marketplace/remove.ts:409`). Unstage returns file keys, so map back in one place: `record.resources.mcpServers.filter(d => removed.has(key(plugin, d)) || removed.has(d))` (the second arm covers legacy raw-name entries), or give `StagedMcpRecord`/unstage results an explicit declared name. The catalog already documents the record keeping "raw source keys" (output-catalog.md:2697), which stays true.
- `install-outcome.ts:975` and `update-swap.ts:698,1442` read `recorded.map(r => r.generatedName)`; give `StagedMcpRecord` a `declaredName` (or keep `generatedName` = declared and add `key`), and update its doc comment.

### Pattern 7: Agent tool mapping (D-03-15)

pi-subagents 0.74.0 facts [VERIFIED: src read from the 0.74.0 tarball]:
- `tools:` entries starting `mcp:` become `mcpDirectTools` (`src/agents/agents.js:449-461`). `mcp:<server>/<tool>` is split with `item.split("/", 2)`; `<server>` must be the **exact adapter config key** and `<tool>` is compared to the **raw MCP tool name** in the adapter's metadata cache (`toolFilter.has(tool.name)`, `mcp-direct-tool-grant.js`). `directTools` mode is not consulted, so `"search"` servers are selectable; the child gets names via the entry's own `toolPrefix` (`"mcp"`), i.e. `mcp__plugin_<p>_<s>__<tool>`.
- Resolution reads config with plain `JSON.parse` from `~/.config/mcp/mcp.json`, `<agentDir>/mcp-adapter.json`, `<projectRoot>/.mcp.json`, `<projectConfigDir>/mcp-adapter.json` (`mcp-direct-tool-allowlist.js` `getConfigPaths`, `readConfig`). A JSONC (commented) `mcp-adapter.json` is skipped silently by pi-subagents.
- It needs a valid adapter metadata cache entry (`configHash` match, ≤ 7 days); otherwise the selector is unresolved.
- Any unresolved selector **throws** at launch (`child-tool-plan.js:218-222`). A foreground child never loads ambient extensions, so `mcp:` tools exist only for `async: true` background children; a foreground launch fails with "MCP tools require background children (`async: true`) because only they load ambient extensions." (`tool-availability.js`).
- `excludeTools` is an exact-name set applied to resolved names (`excludedToolSet.has(selection.name)`, child-tool-plan.js:196-228); `mcp:` forms are not parsed there and unknown names are ignored. So `disallowedTools: mcp__plugin_<p>_<s>__<tool>` maps **verbatim** to `excludeTools: mcp__plugin_<p>_<s>__<tool>` (the delivered name equals the Claude name); whole-server disallow forms have no pi-subagents equivalent and keep the drop warning.
- With the adapter absent and Pi's built-in MCP active, pi-subagents resolves `mcp:` against the built-in (`usesBuiltinMcp`), which never sees our entries, so the selector is unresolved and the launch fails.

Behavior change to surface: today `mcp__` tokens are dropped and the agent launches without MCP tools; after D-03-15 a mapped agent whose `tools:` is an explicit allowlist fails to launch in the foreground and whenever the server's metadata is not cached. See Open Question 7.

Seam: `convert.ts::mapTools(rawTools, rawDisallowed)` (line 209) needs the written server set (declared names minus D-03-10 drops, or their keys). The three agent stage call sites are `install-outcome.ts:855`, `update-swap.ts:304`, `reinstall-replace.ts:431`; the resolver output is available at all three, and the agents phase runs before the MCP phase, so pass a set derived from `resolved.mcpServers`, not from the MCP stage result. The current agent `TOOL_MAP` (convert.ts:54-62) is `Read, Bash, Edit, Write, Grep, Glob, LS` [VERIFIED].

### Tool search and hooks: what the model and hooks actually see

- Default Pi 1.0 + adapter 5: request tools `read, bash, edit, write, mcp` (run E). Pi's `tool_search` is registered `defaultActive: false` (`dist/extensions/tool-search/index.js:11`); docs: "`tool_search` is off by default; enable it with `"defaultTools": ["+tool_search"]` or `--tools`." (`docs/cli.md:172`); the built-in MCP is what activates it for deferred servers (`docs/mcp.md:182`), and the adapter turns the built-in off. [VERIFIED]
- So ANAME-04 / success criterion 4 ("the tools are found through Pi's tool search") holds via the adapter's `mcp({ search })`, which activates the Pi deferred tools (run B), and via Pi's `tool_search` only with the setting. State this precisely in docs and in the verification step (Open Question 2).
- `scripts/pi.sh` launches with `--no-extensions` (lines 216-224), which filters out every `builtin:` path (`resource-loader.js:500`); `builtin:tool-search` loads only with `-e builtin:tool-search`. [VERIFIED]
- Hooks: a direct call to an activated tool emits Pi `tool_call` with the full Claude-form name, so `mcp__plugin_<p>_<s>__<tool>` matchers fire. A call through the proxy (`mcp({ tool: "…" })`) emits `tool_call` with toolName `mcp`, so plugin MCP matchers and `if:` predicates do not fire. The proxy stays registered while any server uses `"search"` (A12 in FEATURES; the `mcp` tool is in every run's request list). Claude routes every MCP call by its full name. This is a documented divergence (license: Pi capability gap), with the adapter's approval broker as the future fix (FEATURES D-5, out of scope).

### ANAME-05 documentation home (Claude's discretion)

Recommend a new `docs/mcp-compatibility.md`, parallel to `docs/hooks-compatibility.md` and `docs/workflows-compatibility.md`, with a "Divergences and documented absences" section (the house pattern in `docs/env-vars.md:129` and `docs/plugin-enablement.md:46`). Phase 3 entries: lazy lifecycle vs. session-long connection (ANAME-05); Pi's `tool_search` off by default; proxy calls invisible to hooks; no length check (provider limits 64/128); timeout semantics and the unset default (Pitfall 3); `-`/`_` refusal (D-03-13); unsupported features. Phase 7 (ADOC-01) then extends it. Also update the README "Name mapping" MCP table (README.md:123-129), which states "MCP server names do not change" and becomes wrong in this phase. Note: `.md` files are formatted by mdformat via pre-commit, not Prettier.

### Anti-Patterns to Avoid

- **Allow-list by deletion.** Building the entry from `{...plugin}` and deleting known-bad keys reopens the pass-through for every future adapter field. Build the output from the table only.
- **Two normalizers.** A second `replace(/[^A-Za-z0-9_-]/g, "_")` outside `domain/name.ts` will drift from the builder Phases 5 and 6 depend on.
- **Classifying in the bridge only.** If the unsupported-feature check lives in the bridge, `list`/`info` (which only resolve) cannot show `partially-available`.
- **Regex for the matcher prefix.** D-03-14 forbids a regex engine; use `startsWith`/`endsWith`/slice as the `if:` code does (it notes Sonar S5852 backtracking).
- **Writing `127.0.0.1` redirect URIs.** Breaks pre-registered OAuth clients that registered Claude's `localhost` form.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONC read of `mcp-adapter.json` | another parser | `bridges/mcp/adapter-doc.ts::readMcpConfigDoc` | Matches the adapter's grammar by construction (D-02-08). |
| Ownership / partition | name-keyed logic | marker-keyed `partitionServers`, `isOwnedBy` | Keys change in this phase; markers do not. |
| Atomic writes | `fs.writeFile` | `shared/atomic-json.ts` | NFR-1, fallow rule pack `write-file-atomic-chokepoint`. |
| Partial-install flow | a new gate | `requireInstallable` / `requirePartialInstallable`, `PluginShapeError.unsupportedKinds`, `narrowUnsupportedKinds` | Already renders the `--partial` hint and per-kind markers across list/info/install (SURF-01). |
| Per-kind marker rendering | per-surface strings | `kindToReason` in `shared/probe-classifiers.ts` | Single mapping keeps list/info/install byte-identical. |
| Adapter facts in tests | importing pi-mcp-adapter | vendored constants + provenance comment + floor-tie test (pattern in `tests/bridges/mcp/adapter-entry.test.ts`) | Adapter must never be a dependency. |

**Key insight:** every change in this phase has a precedent in the tree (`{unsupported hooks}`, `keptOverride`, `if:` prefix predicates, `generatedAgentName`); the risk is in drift between parallel copies, not in new mechanisms.

## Runtime State Inventory

Phase 3 changes server keys and entry shape, so it is rename-shaped. Phases 2-5 ship in one release; the migration of existing entries is Phase 5.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` `resources.mcpServers` holds declared server names (= today's raw keys). | None if the record keeps declared names (Pattern 6); a data migration in Phase 5 only if keys are stored instead. |
| Live service config | Adapter state keyed by server name: OAuth tokens (`sha256(serverName)`), `mcp-cache.json`, `mcp-project-approvals.json` (whole-definition hash, marker included), `/mcp-adapter disable` stubs, pi-subagents `agentOverrides` `mcp:<server>` (PITFALLS Pitfall 6). | Not writable (NFR-10). Phase 3 entries written by new installs use new keys from the start; Phase 5 announces renames. No code action in Phase 3 beyond keeping marker content byte-stable. |
| OS-registered state | None — verified: the extension registers no OS-level tasks or services. | None. |
| Secrets/env vars | None renamed. Credential-bearing adapter fields are now dropped from plugin input (security improvement). | None. |
| Build artifacts | None — no build step; Node runs `.ts` directly. | None. |

## Common Pitfalls

### Pitfall 1: Carry-forward keeps a stale plugin timeout
**What goes wrong:** Old manifest set `timeout`, new one removes it; `carriedFields(previous)` copies the old `requestTimeoutMs` as if it were the user's.
**How to avoid:** Exclude the previous marker's plugin-set names as well as the new ones (Pattern 2, rule 2). Test: update from a manifest with `timeout` to one without, expect no `requestTimeoutMs`.

### Pitfall 2: Collision checks still use declared names
**What goes wrong:** `newNames = Object.keys(servers)` (stage.ts:226) is used for the collision walk, `ours`/`theirs`, `recorded` and notices. Switching only the stamped map leaves checks on the wrong names.
**How to avoid:** Compute `{declared, key}` pairs once at the top of `prepareStageMcpServers`; collisions, partition lookups, `override-kept` notices and file keys use `key`; the record uses `declared`.

### Pitfall 3: Timeout semantics differ and the unset default is 60 s
**What goes wrong:** Claude's `timeout` is a hard wall clock per tool call, default about 28 hours. The adapter's `requestTimeoutMs` restarts on progress, and when unset the MCP SDK default of 60 seconds applies (adapter `docs/prompts-and-ui.md`: "(or the SDK's 60-second default)"; `docs/servers.md:51`). A plugin tool that runs over 60 s without progress fails under the adapter but not under Claude.
**How to avoid:** Document it. Writing a default would block the user override D-03-04 preserves; see Open Question 8.

### Pitfall 4: The `-`/`_` fold applied to the wrong side
**What goes wrong:** Folding only our keys, or folding only within the target file.
**How to avoid:** Fold both sides in every comparison (same plugin, other plugins' marked entries, user servers in all nine sources), keep the `isOwnedBy` exemption.

### Pitfall 5: `info` arms disagree on names
**What goes wrong:** Manifest arm shows `plugin:<p>:<s>`, state-only arm (`sortComponentNames(record.resources.mcpServers)`, info.ts:1702) shows bare names.
**How to avoid:** Derive display in both arms through one helper; update the catalog D-96-01 paragraph (output-catalog.md:2697).

### Pitfall 6: Hidden test blast radius
**What goes wrong:** 35 test files read `mcp-adapter.json` or `mcpAdapterJsonPath` (grep this session) and assert raw keys or entry bodies.
**How to avoid:** Add a test helper that builds expected keys through the production builder (a test may import it); plan fixture updates per wave; keep the new behavior in owner tests.

### Pitfall 7: Complexity ceilings
**What goes wrong:** `stage.ts` (429 lines) and `stampServers` grow past sonarjs/fallow cognitive 15 or fallow unit size.
**How to avoid:** Put the table and classifier in their own module; keep each translation step a small function (one per transport family).

### Pitfall 8: Mapped agents stop launching in the foreground
**What goes wrong:** After D-03-15 an agent whose `tools:` allowlist includes a mapped `mcp:` entry fails in a foreground launch and when the adapter's metadata cache lacks the server.
**How to avoid:** Decide whether to emit a warning or `async: true` (Open Question 7); extend the README "Customizing generated agents" text.

### Pitfall 9: Non-`[A-Za-z0-9_.-]` tool names
**What goes wrong:** Claude normalizes the tool part (`Cn(tool)`); the adapter only replaces `.` (`toolName.replace(/\./g, "_")`, types.ts:894). A tool named `a/b` or with a space reaches the model as a different, provider-invalid name, and a D-03-15 per-tool `mcp:` selector compares raw names.
**How to avoid:** Document as a residual divergence; no fix possible from this side.

## Code Examples

Illustrative skeletons only; names are recommendations, not existing symbols [ASSUMED: names].

```typescript
// domain/name.ts (new) -- ANAME-01: Claude's `plugin:<plugin>:<server>`,
// normalized; the trailing "_" plus the adapter's `toolPrefix: "mcp"` yields
// `mcp__plugin_<p>_<s>__<tool>`.
export function generatedMcpServerKey(plugin: string, server: string): string {
  assertSafeName(plugin);
  return `plugin:${plugin}:${server}`.replace(/[^A-Za-z0-9_-]/g, "_") + "_";
}

// ANAME-03: keys that differ only by "-" vs "_" share one Pi deferred namespace.
export function foldedMcpServerKey(key: string): string {
  return key.replaceAll("-", "_");
}
```

```typescript
// domain/components/hooks/matcher.ts -- ANAME-02 server-prefix form, no regex
// built from input.
function mcpServerPrefix(raw: string): string | undefined {
  if (!raw.startsWith("mcp__") || !raw.endsWith("__.*")) {
    return undefined;
  }

  const segment = raw.slice("mcp__".length, -"__.*".length);
  return MCP_SEGMENT.test(segment) ? `mcp__${segment}__` : undefined;
}
```

Sonar note: the house prefers `replaceAll` with a string argument for literal patterns (memory "Sonar replaceAll string-literal").

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Anthropic tool names ≤ 64 | `^[a-zA-Z0-9_-]{1,128}$` | current platform docs | The adapter's comment "Provider tool-name limit (64 for Bedrock, Anthropic, OpenAI)" (types.ts:546) is out of date for Anthropic. |
| Pi built-in MCP hashes names at 64 | Adapter passes names through | Pi 0.99+ / adapter 5 | Our tools keep exact Claude names. |
| Search-mode tools activated by adapter | Pi deferred tools (Pi owns activation) on Pi ≥ 0.99 | adapter 5.0.0 | Activation survives resume; `tool_search` can load them when active. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A real provider rejects an over-limit name with a 400 and, on Anthropic native tool changes, every later request in the session fails. | Measurement record | If providers truncate instead, the length arm is even less needed; if failure is session-wide, users of OpenAI with long plugin/server names hit hard failures (doc risk only). |
| A2 | Claude does not run host-only types (`sse-ide`, `ws-ide`, `sdk`, `claudeai-proxy`) from plugin configs. | Unsupported features | If Claude runs them, treating them as `{unsupported mcp}` is still correct for us (adapter cannot run them); only the doc wording changes. |
| A3 | `tools[].permission_policy` / `toolPermissions` are enforced by Claude for plugin servers. | E1 | If they are SDK-only, D-03-10 still lists them; a plugin using them would be partial for no runtime reason. |
| A4 | Code-example symbol names (`generatedMcpServerKey`, `foldedMcpServerKey`, `McpServerKeyCollisionError`, `droppedMcpServers`, kind `"mcpServers"`). | Patterns, Code Examples | Naming only. |
| A5 | zod object `u` in the schema chunk is the strip-mode factory found. | E2 | If loose, Claude would keep unknown keys; D-03-08 is locked anyway. |

## Open Questions

1. **Drop the length arm of D-03-10? (needs user confirmation)**
   - What we know: Pi 1.0 + adapter 5 accept and execute any length (runs A, D). D-03-03 says "If the measurement shows no effective limit, the length check is dropped". Providers cap at 64 (OpenAI) and 128 (Anthropic); Claude itself does not check.
   - What's unclear: whether the user wants a provider-oriented guard (e.g., partial at 64 for OpenAI users), which would be a divergence without a Pi gap.
   - Recommendation: drop the length arm per D-03-03, record the measurement, document provider limits in `docs/mcp-compatibility.md`. Planner should carry this as a confirmation checkpoint.
2. **ANAME-04 criterion wording.** Pi's `tool_search` is off by default with the adapter. Recommendation: verify criterion 4 through `mcp({ search })` activating Pi deferred tools (plus a `defaultTools: ["+tool_search"]` variant), and document the setting. Do not change Pi settings from this extension (outside NFR-10).
3. **Breadth of D-03-10's "any other field".** Recommendation: include `bareElicitationCapability: true` and the four host-only `type` values; exclude `role` and `discoveryCache` (internal / equivalent behavior). Confirm with the user.
4. **Invalid values of known fields** (non-integer `timeout`, `callbackPort` out of range, non-https `authServerMetadataUrl`, `url` without `type`, unknown `type`). Claude fails the whole server's zod parse and skips that server with an error while the plugin loads. Options: (a) drop just the bad field with a bridge warning (tolerant, today's spirit), (b) treat the server as `{unsupported mcp}` (closest to Claude's "server not loaded"), (c) keep pass-through. Recommendation: (b) for an unknown/missing transport (`url` with no `type`, unknown `type`), (a) for a bad optional field. Needs a decision; low frequency.
5. **`type: "http"` and `httpTransport`.** Claude's `http` is streamable HTTP; the adapter without `httpTransport` may fall back. Recommendation: leave unset (matches D-03-07's list); revisit if a live test shows fallback misbehaving.
6. **Pipe alternatives with the prefix form** (`mcp__x__.*|Write`). D-03-14 says "exactly the form". Recommendation: accept the prefix form as one alternative inside the existing per-alternative degradation (#217), because Claude would match it; otherwise document that only the whole-matcher form is accepted.
7. **Mapped agents and foreground launches.** pi-subagents fails a foreground launch (and any launch with an uncached server) once `mcp:` entries are present. Recommendation: map as D-03-15 says, add a conversion warning naming the `async: true` requirement, and update README; do not inject `async: true` (changes agent semantics).
8. **Unset timeout default (60 s vs ~28 h).** Recommendation: document only (D-03-07 forbids synthesizing fields); revisit with the user if long-running plugin tools are common.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v26.10.0 | — |
| Pi (`@earendil-works/pi-coding-agent`) | measurement, e2e | ✓ (repo `node_modules`) | 1.0.0 | — |
| pi-mcp-adapter | live checks only | ✓ (scratch `~/.cache/pi-cm-phase3-research/rt`) | 5.0.0 | — (never a repo dependency) |
| pi-subagents | live checks only | ✓ (scratch) | 0.74.0 | — |
| Claude Code binary | upstream evidence | ✓ | 2.1.291 | docs |
| Keyless stub provider | live checks | ✓ (`tests/live-uat/openai-stub-server.mjs`; scripted variant in scratch `bin/stub.mjs`) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none. Note `/tmp` is a tmpfs at 65% inode use; run checks and live probes with `TMPDIR` outside `/tmp`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 26 locally, Node 24 in CI), `node:assert/strict` |
| Config file | none — scripts in `package.json`; reporter `scripts/test-reporter.mjs` |
| Quick run command | `node --test tests/<area>/<file>.test.ts` (owner test) |
| Full suite command | `npm run check` (static + unpaired + integration + direct coverage for all pairs) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANAME-01 | Builder output for plain, hyphenated, dotted and colon-bearing names; entry has `toolPrefix: "mcp"` and the key | unit | `node --test tests/domain/name.test.ts tests/bridges/mcp/adapter-entry.test.ts` | ✅ (extend) |
| ANAME-01 | Written key + vendored adapter formula yields `mcp__plugin_<p>_<s>__<tool>` (provenance: types.ts:871-898, run A) | unit | `node --test tests/bridges/mcp/adapter-entry.test.ts` | ✅ (extend) |
| ANAME-02 | `mcp__<seg>__.*` parses to a prefix kind; dispatch fires on `mcp__plugin_p_s__t`, not on `mcp__plugin_p_s2__t` or `mcp` | unit | `node --test tests/domain/components/hooks/matcher.test.ts tests/bridges/hooks/dispatch.test.ts` | ✅ (extend) |
| ANAME-02 | `if:` literal and `mcp__plugin_p_s` / `__*` forms fire on delivered names (proof, no new code) | unit | `node --test tests/bridges/hooks/if-field/index.test.ts` | ✅ (extend) |
| ANAME-02 | Agent `tools:`/`disallowedTools:` mapping only for written servers; drop warning otherwise; dropped servers not mapped | unit | `node --test tests/bridges/agents/convert.test.ts` | ✅ (extend) |
| ANAME-03 | Same-plugin key clash and folded clash refuse before any write (file bytes unchanged) with the typed error | unit | `node --test tests/bridges/mcp/stage.test.ts` | ✅ (extend) |
| ANAME-03 | Folded clash against another plugin's marked entry and a user server in each source slot | unit | `node --test tests/bridges/mcp/stage.test.ts tests/bridges/mcp/collision-slots.test.ts` | ✅ (extend) |
| ANAME-04 | `directTools: "search"` default; `alwaysLoad: true` → `true`; plugin-declared `directTools` replaced | unit | `node --test tests/bridges/mcp/adapter-entry.test.ts` | ✅ (extend) |
| ANAME-05 | No `lifecycle` written even when the plugin declares one | unit | same | ✅ (extend) |
| ANAME-06 | `description` from plugin.json, fallback entry, omitted when neither | unit | `node --test tests/domain/plugin-resolver.test.ts tests/bridges/mcp/adapter-entry.test.ts` | ✅ (extend) |
| ANAME-07 | Closed table: every `SERVER_ENTRY_KEYS` key and every non-mapped `oauth` key in plugin input is absent from output (security test); `sse` → `httpTransport`; timeout ≥1000 rule; `request_timeout_ms` fold with 300000 cap; `callbackPort` → `http://localhost:<port>/callback`; `scopes` → `scope` | unit | `node --test tests/bridges/mcp/adapter-entry.test.ts` (+ new domain module test) | ✅ / ❌ new module test |
| ANAME-07 | Each unsupported feature → `partially-available` with `unsupported` containing the kind and the dropped-server list; `--partial` stages only supported servers; record derives `partially-installed` | unit + integration | `node --test tests/domain/mcp-resolution.test.ts tests/domain/plugin-resolver.test.ts tests/orchestrators/plugin/install-flow.test.ts` | ✅ (extend) |
| ANAME-07 | Render: `{unsupported mcp}` in list/info/install failure with `--partial` hint; info names server + feature | unit + catalog gate | `node --test tests/shared/probe-classifiers.test.ts && npm run test:architecture` | ✅ (extend) + catalog fixtures |
| D-03-04/05/06 | Carry-forward skips plugin-set fields (new and previous marker); write-back restores kept stub value for plugin-set fields; install warning lists them | unit + integration | `node --test tests/bridges/mcp/adapter-entry.test.ts tests/bridges/mcp/adapter-doc.test.ts tests/integration/mcp-override-lifecycle.test.ts` | ✅ (extend) |
| Live | Real adapter loads the new entry; tools reachable by search; marker ignored | manual / live UAT | scratch `bin/run.sh` recipe (this file) | manual — Phase 7 ADOC-02 carries the formal UAT |

### Sampling Rate
- **Per task commit:** the pre-commit hook runs `npm run check:commit` (static + unpaired + staged pairs); during work, the owner test.
- **Per wave merge:** `npm run check` on the combined tree.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`; record command, exit status, commit and Node version.

### Wave 0 Gaps
- [ ] Paired test for the new domain table/classifier module (e.g. `tests/domain/mcp-server-features.test.ts`).
- [ ] Shared expected-key helper for the ~35 MCP-touching tests (or import the production builder in tests).
- [ ] Catalog-uat fixtures for every new `{unsupported mcp}` block in `docs/output-catalog.md`.
- Framework install: none needed.

## Security Domain

Security enforcement is on (ASVS L1, block on high).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (OAuth fields of plugin servers) | Closed `oauth` sub-table; drop `clientSecret`, `skipIssuerMetadataValidation`, `grantType`, `authorizationParams`, `clientMetadataUrl`; https-only metadata URL as Claude requires |
| V3 Session Management | no | — |
| V4 Access Control | yes (adapter policy fields) | Drop plugin-set `approveTools`, `auth`, `includeTools`/`excludeTools`; these stay user-owned carried fields |
| V5 Input Validation | yes | Closed allow-list translation from the table; typed validation of `timeout`/`callbackPort`; server names through the builder (`[A-Za-z0-9_-]` only) |
| V6 Cryptography | no | — |
| V8 Data Protection | yes | No credential field copied from plugin input; marker keeps only field NAMES (D-03-05) |

### Known Threat Patterns (inputs for the planner's threat model)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Plugin sets `auth: { "provider": "<pi provider>" }` in a user-scope install: the adapter sends the user's Pi provider token to the plugin's URL ("user-global config only", and `<agentDir>/mcp-adapter.json` IS user-global) | Information disclosure | Closed translation drops `auth` (HIGH severity today under pass-through; closed by D-03-07). Security test required. |
| `bearerTokenEnv: "ANTHROPIC_API_KEY"` (or any env var) / `bearerToken` | Information disclosure | Dropped. |
| `requestHeadersCommand`, `socket`, `caFile`, `cwd`, `inheritEnv`, `literalEnv`, `trace`, `pluginDataDir`, `lifecycle: "eager" \| "keep-alive"` | Elevation / Tampering / Disclosure | Dropped. |
| `oauth.skipIssuerMetadataValidation: true` (mix-up protection off), `oauth.clientSecret`, `grantType: "client_credentials"`, `authorizationParams` | Spoofing / Disclosure | Dropped (only four oauth keys mapped). |
| Plugin `approveTools: false` overriding a user's global approval policy (per-server overrides global) | Elevation | Dropped; `approveTools` stays a user-carried field. |
| Over-long names breaking provider requests | Denial of service | Documented (Open Question 1); no Pi-side guard. |
| Plugin `description` becomes model-visible namespace text | Tampering (prompt injection surface) | Same exposure class as Claude's server instructions; accept and note. |

**Residual risks after this phase (accepted or later phases):** plugin still controls `command`/`args`/`env` (code execution — same as Claude, by design); `url`/`headers` send data to the plugin's server (same as Claude); a leading `!` in `env`/`headers` runs a shell command under the adapter and `${VAR}` can expand credentials into `url`/`headers` until Phase 4 (AVAR-03, AVAR-05) — acceptable because Phases 2-5 ship in one release; proxied calls bypass plugin hooks (documented); marker content is in the project-approval hash (accepted in 02-10).

## Sources

### Primary (HIGH confidence)
- Live sandboxed runs A, B, C, C2, C4, C5, D, E (this session), Pi 1.0.0 + pi-mcp-adapter 5.0.0.
- pi-mcp-adapter 5.0.0 source: `types.ts` (ServerEntry 438-525, formatServerNamespace 549, getServerPrefix 871, formatToolName 888, resolveToolPrefix 901), `index.ts` (deferSearchTools 391, deferredToolFields 436-460), `config.ts` (claudePlugins namespace shadowing 558-576, Pi-format timeout seconds 1236, callbackPort 1256-1278), `mcp-auth-flow.ts` 400-445, `server-manager.ts` 1409-1426, `metadata-cache.ts` 108-136, docs `tools.md`, `servers.md`, `configuration.md`, `prompts-and-ui.md`.
- `@earendil-works/pi-coding-agent` 1.0.0: `dist/extensions/tool-search/{index,tool}.js`, `dist/core/resource-loader.js:403,500`, `dist/core/settings-manager.js:35`, `dist/core/extensions/loader.js:231`, `dist/extensions/mcp/tools.js:30,49`, `docs/cli.md:172`, `docs/mcp.md:182`; nested pi-ai 1.0.0 `api/openai-completions.js`, `api/anthropic-messages.js`.
- pi-subagents 0.74.0: `docs/agents.md`, `src/runs/shared/{mcp-direct-tool-allowlist,mcp-direct-tool-grant,child-tool-plan,tool-availability}.js`, `src/agents/agents.js`.
- Claude Code 2.1.291 binary (grep, verbatim fragments in E1-E8).
- Repository files read this session (cited inline with line numbers).

### Secondary (MEDIUM confidence)
- https://code.claude.com/docs/en/mcp (timeouts, OAuth, headersHelper, tool search, plugin naming, alwaysLoad).
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools (tool name regex `{1,128}`).
- https://github.com/openai/openai-node `src/resources/shared.ts` (`FunctionDefinition.name`, max 64).

### Tertiary (LOW confidence)
- None used for conclusions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing modules only.
- Measurement and runtime behavior: HIGH — observed live with decisive logs.
- Upstream (Claude) table: MEDIUM-HIGH — verbatim binary fragments plus docs; strip-mode binding inferred by name.
- Architecture recommendations: MEDIUM — follow existing precedents; record-name choice and module split are planner decisions.
- Pitfalls: HIGH for code-derived ones, MEDIUM for provider failure modes.

**Research date:** 2026-10-06
**Valid until:** 2026-11-05 (pinned versions; re-check if the adapter, pi-subagents or Pi floor moves)
