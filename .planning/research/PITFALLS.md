# Pitfalls Research

**Domain:** Brownfield Pi extension: Pi 1.0 floor bump, and plugin MCP delivery moved from `mcp.json` to pi-mcp-adapter 5's `mcp-adapter.json` (milestone `mcp-4`)
**Researched:** 2026-10-01
**Confidence:** HIGH for adapter and Pi behavior read from the published tarballs (`pi-mcp-adapter@5.0.0`, `@earendil-works/pi-coding-agent@1.0.0`) and from the `features/mcp` branch records. MEDIUM where a runtime behavior was read in source but not observed. Claude Code facts come from code.claude.com/docs/en/mcp through WebFetch; the research seam rates that tier LOW. The `features/mcp` spike's binary grep backs the naming facts.

## Phase vocabulary used below

The roadmap does not exist yet. This file names phases by concern, in the order the pitfalls suggest:

| Tag | Concern |
| --- | --- |
| **FLOOR** | Pi `>=1.0.0`, pi-subagents `>=0.74.0`, adapter 5 as the documented soft dep, all devDeps bumped, canaries re-run |
| **DETECT** | Adapter-only detection: `{requires pi-mcp}` when the adapter is absent, even if Pi's built-in MCP is active |
| **DELIVER** | Stage and unstage in `<scopeRoot>/mcp-adapter.json`, the NFR-10 write set, the 9-source collision walk, `directTools: "search"` |
| **NAME** | Server keys from Claude Code's `plugin:<plugin>:<server>`, normalized |
| **VARS** | `${VAR:-default}` parity and escaping against the adapter's second expansion pass |
| **MIGRATE** | Reconcile moves marked entries out of both `mcp.json` files on `/reload` |
| **STATUS** | Live adapter status in `/claude:plugin info` |
| **DOCS** | Docs, live UAT, milestone close |

**Ordering consequence (the most important one):** MIGRATE must ship in the same release as, and plan after, DELIVER + NAME + VARS. Every change to an entry's shape (name, `directTools`, escaping) also changes the adapter's project-approval hash, OAuth key and cache key. If migration moves entries before the final shape exists, a second rewrite follows, and users pay for re-approvals and re-sign-ins twice. Cut no release between DELIVER and MIGRATE: a user on that build gets new installs in `mcp-adapter.json` and old ones still in `mcp.json`.

---

## Critical Pitfalls

### Pitfall 1: A commented `mcp-adapter.json` is read as malformed and wiped on the next install

**What goes wrong:**
`bridges/mcp/stage.ts::readScopedDoc` parses with `JSON.parse`. On any parse failure it returns `{ doc: {}, malformed: true }`, and the commit then **replaces the whole file** ("non-plugin entries in it are lost"). `mcp.json` is strict JSON, so this tolerance was mostly theoretical. `mcp-adapter.json` is different: the adapter reads it with `parseJsonWithComments` = `strip-json-comments` with `trailingCommas: true` plus a UTF-8 BOM strip (`utils.ts:13-15`). A user file with one `//` comment or a trailing comma loads fine in the adapter, but our extension would treat it as malformed. It would then drop the user's `settings`, `imports`, `claudePlugins` and every hand-written server. `unstage.ts` throws `malformed JSON` instead, so uninstall would fail on every retry.

**Why it happens:**
Stage and unstage are retargeted by swapping the `mcpJsonPath` getter. The parse step looks like plumbing, so nobody revisits it.

**How to avoid:**
- Parse with the adapter's exact grammar: BOM strip, comments, trailing commas. Add a test that feeds the same fixture to both parsers.
- Never treat an unparseable `mcp-adapter.json` as empty. Refuse the stage with a typed error that names the file (fail-clean, NFR-3), the way `unstage` already does.
- Decide what happens to comments on rewrite. Our `atomicWriteJson` drops them, and so do the adapter's own writers (`writeRawConfigObject`, `config.ts:1648`). Either accept that with a one-time warning when the source text had comments, or patch only the `mcpServers.<name>` paths with a comment-preserving editor (`jsonc-parser`'s `modify` and `applyEdits`). A new runtime dependency is a STACK decision. Silently dropping comments without saying so is not an option.

**Warning signs:** a test fixture for `mcp-adapter.json` that has no comment, trailing comma or BOM. The `malformed ... it will be replaced` warning text survives into the new bridge.

**Phase to address:** DELIVER (before any write lands). MIGRATE reuses the same reader.

---

### Pitfall 2: The adapter's `mcp-servers` alias makes user servers disappear when we add `mcpServers`

**What goes wrong:**
The adapter reads `raw.mcpServers ?? raw["mcp-servers"]` (`config.ts:1288`, `getServersObject`). A user file that uses the legacy `mcp-servers` key works today. If our stage adds a top-level `mcpServers`, the `??` chooses ours, and every user server under `mcp-servers` stops loading. Nothing reports it.

**How to avoid:** Mirror the adapter's own writer, `setServersObject`: fold `mcp-servers` into `mcpServers` and delete the alias in the same atomic write, or write into whichever key exists. The partition (ours/theirs by marker) must enumerate both keys. Add a fixture with `mcp-servers` only.

**Warning signs:** `classifyMcpServers` still looks only at `mcpServers`.

**Phase to address:** DELIVER.

---

### Pitfall 3: Adapter-written overlays on our names cause false collisions and get clobbered on update

**What goes wrong:**
The adapter writes into the files we now own, keyed by our server names:
- `/mcp-adapter disable|enable <server>` always writes the **project** `.pi/mcp-adapter.json` (`writeProjectServerDisabledOverride`, `config.ts:1715`). For a user-scope plugin server, that produces a marker-less stub `{ "disabled": true }`. For a project-scope one, it produces `{ ...ourEntry, disabled: true }`, which keeps our marker.
- The `/mcp-adapter` panel's direct-tools toggle writes `directTools` into the entry (`writeDirectToolsConfig`, `config.ts:1961`). For a server that came from Pi's `mcp.json` (an "import" provenance), it **copies the whole translated definition** into `mcp-adapter.json` without our marker. Translation dropped the `_piClaudeMarketplace` key as an "ignored setting".

Consequences:
1. The new 9-source collision walk sees the marker-less stub or the copied definition as another declarer of our name. It then **refuses update or reinstall of a user-scope plugin** whenever cwd is that project, and refuses a migration into `mcp-adapter.json` when a pre-migration panel copy exists. Under NFR-3, a fail-clean refusal on every `/reload` is a loop the user cannot break without hand-editing.
2. Our "ours" partition replaces the whole entry on update or reinstall, so the user's `disabled: true` or `directTools` choice silently reverts. Claude Code keeps a user's `/mcp` disable of a plugin server across plugin updates. Parity says preserve it.

**How to avoid:**
- In the collision walk, treat an entry with no transport (`command`, `url`, `socket`) as an **overlay**, not a declarer. That matches the adapter's per-field `mergeServerMaps`.
- On re-stage, carry forward user-owned overlay fields from the previous "ours" entry. The list to decide in the plan: `disabled`, `directTools`, `approveTools`, `includeTools`, `excludeTools`, `lifecycle`, `idleTimeout`, `requestTimeoutMs`, `toolPrefix`, `debug`. Write down which fields we own and which the user owns.
- Before writing, MIGRATE must look for marker-less panel copies of our servers in `mcp-adapter.json` and reconcile them. Deleting a user-authored entry needs a decision, not a default.

**Warning signs:** collision tests use only full server definitions as "theirs", and no test plants `{ "disabled": true }`.

**Phase to address:** DELIVER (walk and overlay rule), MIGRATE (panel copies).

---

### Pitfall 4: Half-migrated state runs every plugin server twice, under two names

**What goes wrong:**
MIGRATE touches up to four files per run: user and project `mcp.json` and `mcp-adapter.json`, plus `state.json`. They cannot change in one atomic step. With NAME in the same release, the migrated entry has a **new** key (`plugin_<p>_<s>`), and the leftover `mcp.json` entry keeps the old key. The adapter loads both, from source 4 (`<agentDir>/mcp.json`) and source 5 (`mcp-adapter.json`). Two processes start for one server, the tools appear twice under different names, and an OAuth server asks for sign-in under the new name.

If the remove happens before the add, a crash loses the server instead: the record says installed, but no file has it.

**Why it happens:** It looks like a move. In fact it is a cross-file transaction with no shared lock. The adapter does not take our `proper-lockfile`, and Pi's `pi mcp add` rewrites `mcp.json` with a plain `writeFileSync`.

**How to avoid:**
- Order: **add to `mcp-adapter.json` first, then remove from `mcp.json`**. A crash in between leaves a duplicate, which is recoverable, never a loss.
- Make the pass a fixed point keyed by content, not by a version stamp. Every `/reload` scans both `mcp.json` files for `_piClaudeMarketplace` entries. "Already present in `mcp-adapter.json` with the same marker" means "only remove the old one". A retry after any crash converges (NFR-3).
- Do **not** hang it on the backfill gate. `orchestrators/reconcile/backfill.ts` stamps `lastReconciledExtensionVersion` unconditionally once the gate opens (D-68-03). A migration that failed halfway would never run again.
- Take the per-scope locks in a fixed order (user, then project) to avoid self-deadlock. `proper-lockfile` is configured `retries: 0` and is not re-entrant.
- Decide orphans explicitly: a marked `mcp.json` entry with no matching enabled record in that scope (stale, disabled, or the other scope's). Moving it brings a dead server back. Leaving it keeps the adapter's per-start "Ignored settings" warning.

**Warning signs:** the migration test injects no failure between the two writes. The plan says "move".

**Phase to address:** MIGRATE.

---

### Pitfall 5: Migration needs two `/reload`s, and nothing says so

**What goes wrong:**
Pi emits `session_start` **before** `resources_discover` (Pi 1.0 `types.d.ts`: "Fired after session_start", also noted in our `index.ts`). The adapter reads its config at factory load (`earlyConfig`, `index.ts:368`) and initializes servers in `session_start` (`core.initializeMcp`, `index.ts:1086`). Our reconcile runs in `resources_discover`, which is too late for the session that triggered it. The first `/reload` after the upgrade still runs the old `mcp.json` entries. Their `_piClaudeMarketplace` key appears in the adapter's per-start "Ignored settings" warning (`getLegacyMcpMigrationNotices`). Only the second `/reload` runs the migrated, renamed entries. The order between extensions at load is set by settings order, which we do not control.

**How to avoid:** Accept a two-step convergence (NFR-2 says `/reload` must suffice, not one `/reload`), and make the migration notification end with the reload hint, so the user knows a second `/reload` is needed. Do not try to win the race by mutating files in our factory: there is no `ctx`, no notify, and no stable order. The live UAT must count reloads: after the first one the old names still run, after the second only the new ones.

**Warning signs:** the UAT script does one `/reload` and checks `/mcp`. The notification says "migrated" with no reload trailer.

**Phase to address:** MIGRATE (behavior and message), DOCS (UAT).

---

### Pitfall 6: Renaming servers silently orphans sign-ins, approvals, overrides and allow-lists

**What goes wrong:**
In adapter 5, almost every piece of per-server state is keyed by the **server name**:

| Adapter state | Key | Effect of a rename |
| --- | --- | --- |
| OAuth tokens (OS keyring, or `mcp-oauth*/`) | `sha256(serverName)` (`mcp-auth.ts:652`) | Signed-in HTTP servers ask to sign in again |
| `mcp-cache.json` metadata | server name + `configHash` | Entries for old names never expire: `saveMetadataCache` never prunes. New names need discovery, so `directTools: "search"` tools are missing until discovery finishes |
| `mcp-project-approvals.json` | `projectRoot` + `serverName` + `definitionHash` of the **whole** canonicalized entry | Every project-scope plugin server needs approval again. Any later shape change (marker, `directTools`, escaping) does the same |
| `/mcp-adapter disable` overrides | name in `.pi/mcp-adapter.json` | The disable no longer applies, and the server comes back |
| User settings | `settings.jev.allowedServers`, `approveTools`, `includeTools` patterns, pi-subagents `agentOverrides[...].tools` with `mcp:<server>` (our own `bridges/agents/convert.ts` warning tells users to write this) | All stop matching |

Pi 1.0 also moved its built-in OAuth store to per-name+URL keys. That matters only for adapter sign-in imports, which match by exact URL.

**Why it happens:** NAME is treated as a string transform. The keys live in files outside our NFR-10 write set (`<agentDir>/mcp-cache.json`, the keyring, `mcp-project-approvals.json`), so we cannot fix them up, and must not try.

**How to avoid:**
- Rename once. Land NAME with DELIVER and VARS, before MIGRATE, so users pay these costs once.
- In the migration notification, list the renamed servers (`old -> new`) and say that signed-in servers need `/mcp-adapter` sign-in again and that project servers need approval again.
- Never write `mcp-cache.json`, the keyring or approval files (NFR-10). Document the stale cache entries as harmless.
- Keep every written entry byte-stable across reloads when nothing changed. A rewrite that only reorders keys still changes `definitionHash` for project servers, so approval prompts come back.

**Warning signs:** the rename lands with no message listing old and new names. A reconcile pass rewrites `mcp-adapter.json` on every load.

**Phase to address:** NAME (decision and message), MIGRATE (the one-time rename), DOCS.

---

### Pitfall 7: The adapter expands values a second time, and several fields have no escape

**What goes wrong:**
Whatever we write, the adapter interpolates again when it connects:

| Field | Adapter processing (5.0.0 source) | Escape available? |
| --- | --- | --- |
| `command`, `cwd` | `resolveConfigPath`: `${NAME}`, `$env:NAME`, `{env:NAME}` (each `\w+`), then leading `~/` to home | **None** |
| `args[]` | `interpolateEnvVars` then `expandHomePath` per element | **None** |
| `env` values | `resolveCommandSecret`: leading `!` **runs a shell command** (10 s, 1 MiB). `!!` runs nothing: the leading `!` is stripped and env refs are interpolated. Otherwise it interpolates | `!!` for a leading `!`, but refs are still interpolated. `literalEnv: true` makes the **whole record** literal, which also turns off `${VAR}` |
| `headers` values | Same as `env` (`resolveCommandSecretsRecord`), unless OAuth is on (`resolveOAuthHeaders`) | `!!` only |
| `url` | `resolveServerUrl`: interpolates, **throws** on a missing var | **None** |
| `bearerToken` | `interpolateSecretExpression` (`!` and `!!` rules) | `!!` only |

Three properties matter:
- The adapter's pattern is `\$\{(\w+)\}`. It does **not** match `${VAR:-default}`, so text like that passes through literally. The adapter never applies a default.
- A missing variable becomes `""` in `args`, `env` and `headers`, and is an error in `url`. Claude Code instead "uses the unexpanded `${VAR}` text as-is" and warns.
- A literal `$env:FOO`, `{env:FOO}` or leading `~/` in a Claude plugin config is plain text under Claude Code (no shell is involved), but the adapter rewrites it.

So "escape what the adapter would expand again" cannot be exact for `command`, `args`, `cwd` and `url`. Those fields have no escape syntax.

**How to avoid:**
- Write a per-field matrix like the table above into the VARS plan, and test each cell against the adapter's real functions. Pin `pi-mcp-adapter@5.0.0` in a scratch prefix and call `interpolateEnvVars`, `resolveCommandSecret` and `expandHomePath` with fixtures. Do not test against a re-typed copy of them.
- Where no escape exists, detect the collision at stage time and surface it as a degradation reason or warning. MENVX-01's "Warn" disposition is the honest default there. Do not claim parity.
- Use `!!` for a leading `!` in `env`, `headers` and `bearerToken` (MENVX-01 "Escape"). Remember that `!!x` still interpolates `x`.
- Evaluate `literalEnv: true` (ENVLIT-01) only with this table in hand. It fixes `!` and `$env:` in `env`, but turns off runtime `${VAR}`, so we would then have to expand env ourselves, which leads to Pitfall 8.

**Warning signs:** a single "escape" helper applied to every string leaf. `bridges/mcp/substitute.ts` today walks every string at every depth, while Claude Code expands only `command`, `args`, `env`, `url` and `headers`. Tests compare against our own re-implementation of the adapter.

**Phase to address:** VARS.

---

### Pitfall 8: Expanding `${VAR}` ourselves writes secrets to disk and defeats Claude Code's credential guard

**What goes wrong:**
The simplest way to support `${VAR:-default}` is to resolve every variable at write time. That writes the **value** of `${GITHUB_TOKEN}` into `mcp-adapter.json`. A project-scope `.pi/mcp-adapter.json` is often committed to git. The value is also frozen until the next reconcile, while Claude Code expands at load and connection time.

The reverse mistake is just as bad: passing `${ANTHROPIC_API_KEY}` through to the adapter. In a remote server's `url` and `headers`, Claude Code reads `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `AWS_BEARER_TOKEN_BEDROCK`, `HTTPS_PROXY` and `NPM_TOKEN` **as empty, ignoring any `:-default`**, so a plugin cannot send those credentials to a server it names. The adapter has no such list, so a pass-through would send the real key.

**How to avoid:**
- Never persist the value of an environment variable. The features/mcp Phase 3 D-06 rule ("no environment value is saved") still applies.
- One workable design to evaluate in VARS: re-render at reconcile time. If `VAR` is set, write `${VAR}` and let the adapter expand it at runtime, so no value is persisted. If it is unset, write the plugin-authored `default` literal. This tracks env changes at `/reload` granularity. Its cost: the file is rewritten whenever env changes, and each rewrite invalidates the project-approval hash (Pitfall 6). Two terminals with different env also flip the file back and forth.
- Apply Claude Code's credential deny-list in `url` and `headers`, and test it as a security control.
- `headersHelper` (Claude Code) has no adapter equivalent. The adapter's `requestHeadersCommand` has a different shape. Do not map one onto the other silently.

**Warning signs:** a fixture `mcp-adapter.json` that contains a literal token value. No test plants `${ANTHROPIC_API_KEY}` in a header.

**Phase to address:** VARS (with a threat model). The security review gate should flag the phase.

---

### Pitfall 9: Normalized names still collide, overflow, and miss hook matchers

**What goes wrong:**
Claude Code calls the server `plugin:<plugin>:<server>` and its tools `mcp__plugin_<plugin>_<server>__<tool>`, after replacing every character outside `[A-Za-z0-9_-]` with `_`. The adapter names things differently:
- A direct or search tool is `formatToolName(tool, server, toolPrefix)`. With the default `toolPrefix: "server"` that is `plugin_<p>_<s>_<tool>`: one underscore before the tool, no `mcp__`. With `"mcp"` it is `mcp__plugin_<p>_<s>_<tool>`. **No mode produces Claude Code's `mcp__X__tool`.** A user's global `settings.toolPrefix` (`short`, `none`, `mcp`) changes our tool names unless each entry pins `toolPrefix`.
- If the raw key keeps `:`, `sanitizeServerPrefix` encodes it as `_3a_` (`plugin_3a_foo_3a_bar_tool`). Pi's `mcp.json` translation also rejects names outside `[A-Za-z0-9_-]` (`translatePiMcpServer`). So write the normalized form, never the raw key.
- The Pi deferred-tool namespace is `mcp__${server.replace(/-/g, "_")}`. Past 59 characters it becomes a hashed `_mcpns__h_...` (`formatServerNamespace`). Names that differ only in `-` versus `_` collide (`plugin_my-tool_docs` and `plugin_my_tool_docs`). This is the same folding D-09 handled on features/mcp.
- Tool names: `plugin_<p>_<s>_<tool>` easily passes 64 characters. The adapter applies no length cap to direct-tool names. Whether Pi 1.0 truncates an extension-registered name, or a provider rejects the request, was **not verified** (MEDIUM). If the provider rejects it, every request in the session could fail.
- Hook matchers and `if:` predicates (`domain/components/hooks/matcher.ts`, `bridges/hooks/if-field/index.ts`) match `mcp__<server>__<tool>` by exact name. Under the adapter they never matched. `docs/hooks-compatibility.md:107` claims they do. After the rename a plugin's own Claude-style matcher could be mapped, but only at hook staging time, using the plugin's known server names. The string cannot be split back afterwards (`plugin_a_b_c`). Proxied calls arrive as tool `mcp` with `{ tool }` in the input.

**How to avoid:**
- Put one shared pure name builder in `domain/` (normalize, then fold for collision checks). DELIVER, NAME, MIGRATE, STATUS and hook mapping must all call it. An architecture gate should forbid a second copy, in the style of the existing source-walk gates.
- Pin `toolPrefix` on every entry we write, or decide explicitly to honor the user's global prefix.
- Extend the PI-6 cross-plugin guard to folded MCP names (features/mcp Phase 3 D-08 and D-09).
- Measure the 64-character question on Pi 1.0 with a long fixture name before NAME is planned. The features/mcp spike only measured Pi's built-in MCP, which hashes at 64.
- Correct or scope the `hooks-compatibility.md` claim.

**Warning signs:** two name builders exist. No fixture plugin has a hyphen or a 40-character name.

**Phase to address:** NAME (needs a measurement step first). DOCS fixes the hooks doc.

---

### Pitfall 10: Detection probe: false positives from any `mcp` tool, false negatives with `disableProxyTool`

**What goes wrong:**
`platform/pi-api.ts::hasLoadedPiMcpAdapter` returns true for a tool named `mcp`, or a `sourceInfo.source` that contains `pi-mcp-adapter`.
- Pi 1.0's built-in does **not** cause a false positive. It registers `mcp__<server>__<tool>` tools with source `builtin`, and a `/mcp` command. Any **third-party** extension that registers a tool named `mcp` does.
- False negatives: adapter 5 unregisters the `mcp` proxy tool when `settings.disableProxyTool` is true and every tool is eager-direct (`syncProxyTool`, `index.ts:2270`). A local-path or fork install has a `sourceInfo.source` without `pi-mcp-adapter`. An adapter with zero servers and the proxy disabled leaves no tool at all.
- `/mcp` ownership is no longer a usable signal. The abandoned features/mcp Phase 2 probe (D-01: `/mcp` from `builtin:mcp`) now points the wrong way, because adapter 5 registers `/mcp` itself on Pi 0.99+ (`index.ts:1700`).

**How to avoid:** Probe `pi.getCommands()` for `mcp-adapter`. The adapter always registers that command, and it is the adapter's own name. Keep the `mcp` tool check only as a fallback. Keep the house rule from features/mcp D-04: a probe that throws means "not loaded" (a possible false warning, never a false all-clear). Rename `ToolInventory` when it widens to commands (features/mcp IN-02). Unit-test four states (adapter, built-in only, neither, a third-party `mcp` tool), plus one real-Pi RPC run.

**Warning signs:** the probe still keys on `/mcp`. No test plants a foreign `mcp` tool.

**Phase to address:** DETECT.

---

### Pitfall 11: Live status reads an event stream, not a query, and lazy servers look broken

**What goes wrong:**
Adapter 5 exposes status only as a push event, `pi-mcp-adapter/status/v1` on `pi.events` (`mcp-status.ts`). It publishes at init and on changes, and publishes an **empty** server list at shutdown. No request/response exists. In adapter 5 most servers are stopped by design: "discovered at startup and then stopped until you use them". So the normal state is `cached` or `not-connected`, not `connected`. Project servers waiting for approval are `blocked`, with a `blockedReason`.

**How to avoid:**
- Subscribe in the factory, before any `session_start` handler runs, and cache the last snapshot per session. Treat the empty shutdown snapshot as "unknown", not "every server gone".
- Map snapshot names with the shared name builder from Pitfall 9.
- Render `cached` and `not-connected` as normal resting states. A reader must not take them as failures.
- Do the lookup in the orchestrator, not in the renderer ("notify is a dumb renderer"). The `info` path stays network-free (NFR-5): reading the cached snapshot never connects anything.
- Version-gate on `MCP_STATUS_SNAPSHOT_VERSION === 1`. Any other version renders "status unavailable".
- Decide whether the LLM `info` tool gets the same field, and pin its payload so it does not drift.

**Warning signs:** `info` shows "not connected" for every lazy server in the UAT. A test emits a snapshot before subscribing.

**Phase to address:** STATUS.

---

### Pitfall 12: The `features/mcp` fixes are lost or misapplied when replayed at Pi 1.0

**What goes wrong:**
The Pi 0.99 work on `features/mcp` holds fixes that main does not have. Each has a trap:

| Finding | Status on main | Trap |
| --- | --- | --- |
| `74162ca6`: `ToolInfo.exposure` is required, so three `toolInfo()` fixtures need `exposure: "direct"`. `tests/edge/handlers/tools.test.ts` types `ctx` as `ExtensionToolContext`. Re-derived upstream type-member pins | Not on main (main is at 0.87.1, pins `types.d.ts:406:5` and `:414:5`) | Pins are `line:col` and must be **re-derived from the installed file**, not cherry-picked. Pi 1.0's `ResourcesDiscoverEvent.type` / `reason` / `themePaths` sit at 525 / 527 / 533, the same as 0.99.2, but check after `npm install`. Prettier formatting moves pins (memory note). IN-03: the `toolInfo` fixture is copied three times, so a seed module saves the next bump |
| `5b1d8ef6`, `dac3a245`, `69e0870a`: pi-subagents ships compiled `.js` (0.73.1+), so the loaders import `src/agents/*.js` in place. Fail on a broken peer, skip below the floor | Not on main: main's `provenance-invisibility` / `skill-path-resolution` still copy `.ts` and **skip silently** against 0.74 | The floor constant is duplicated in two files with no gate against `package.json` (IN-05). Prereleases compare wrong (IN-06). A wrong `PI_SUBAGENTS_ROOT` reads as "not installed" (IN-07). The operator's global pi-subagents is 0.47.1, so locally these tests skip by design. CI has no global peer, so they skip there too. Only a scratch-prefix run with `PI_SUBAGENTS_ROOT` proves the 0.74.0 floor |
| `4f82096f` + `0febc4ea` + `4460d902` + `e0ccc16e`: Stop canary floor and `capBoundFailure` routing | Not on main | `4f82096f` **deleted two README sections**, and `0febc4ea` restored them. Replaying the first without the second loses the engine canary docs. IN-08..IN-10 (exit code not read, regressions share exit 1 with the normal headless result) are still open |
| `tests/e2e/_rpc.ts` RPC harness (cwd/realpath sandbox check, process-group kill) | Not on main | IN-05: a clean exit does not sweep the process group. With adapter 5 discovering and spawning stdio servers at startup, grandchildren outlive the run or hold stderr until the hard stop (`timedOut: true` on a passing run). IN-04: `realpath` throws a raw ENOENT for a missing sandbox dir. `ctx.ui.notify` prints nothing in print and json mode (D-20), so marker and status assertions need RPC |
| Spike sandbox finding: the repo's `.agents/skills` makes Pi ask for trust in **every directory under the repo** | Unrecorded on main | An e2e sandbox under the repo is untrusted, so the adapter **blocks project servers**. Write a trust entry, or put the sandbox outside the repo |
| `/tmp` ran out of inodes during the bump (clone-cache temp-dir leak, fixed on main by #232) | Fixed | Still run `npm run check` with `TMPDIR` outside `/tmp`, and an unpiped log ending in `CHECK_EXIT` |

**How to avoid:** Re-implement against the current tree. Use the features/mcp commits as specifications, not patches: `features/mcp` merged a different `main`, and the contracts pins and test hubs have moved since. Port the open Info findings that cheapen the next bump (IN-03, IN-04, IN-05) as deliberate scope, or record them as deferred.

**Warning signs:** a `git cherry-pick 74162ca6`. `lint:type-members` exits 2 with empty stdout after a merge (memory: contracts pins are merge-fragile). The pi-subagents tests report `skipped` in the "green" floor run.

**Phase to address:** FLOOR.

---

### Pitfall 13: Dev and CI environments that cannot show the feature

**What goes wrong:**
- `scripts/pi.sh` pins `pi-mcp-adapter@2.37.0` and `pi-subagents@0.71.0`, and launches with `--no-extensions`. On Pi 0.99+ that flag also removes `builtin:tool-search` (spike SD-5). Adapter 5's `directTools: "search"` tools are Pi deferred tools that "Pi's `tool_search` finds" (adapter CHANGELOG 5.0.0), so the dev launcher can hide the exposure this milestone adds. Check it on 1.0 (MEDIUM).
- Adapter 5 on first start writes `"-builtin:mcp"` into Pi's **user** `settings.json` and records the version in its onboarding state. A live UAT run without a sandboxed `PI_CODING_AGENT_DIR` edits the operator's real settings. (The harness refuses a `HOME` override, but `getAgentDir` honors `PI_CODING_AGENT_DIR`.)
- The adapter stores OAuth in the OS keyring (`@napi-rs/keyring`). Headless CI may have no secret service. The adapter's own tests set `PI_MCP_ADAPTER_TEST_AUTH_STORE=memory` (MEDIUM: whether a non-test run needs it was not checked).
- Pi 1.0 runs fullscreen by default. tmux or pexpect-driven live checks may need `--tui-mode regular`.

**How to avoid:** Bump the `scripts/pi.sh` pins in FLOOR. Keep `builtin:tool-search` loaded, as the spike's Phase 7 criterion 3 already required. Sandbox `PI_CODING_AGENT_DIR` in every real-Pi run. Set the memory auth store in e2e.

**Phase to address:** FLOOR (launcher pins), DELIVER (the search-exposure check), DOCS (UAT recipe).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
| --- | --- | --- | --- |
| Import `pi-mcp-adapter/config` (`getServerProvenance`, `loadMcpConfig`) for the collision walk (MCPSRC-01's "third direction") | Precedence cannot drift | Makes the adapter a real dependency. Its optional peer `@earendil-works/pi-ai` stops at `^0.99.0` while Pi 1.0 pulls pi-ai `^1.0.0`, so an install can hit ERESOLVE. The milestone says to record that gap, not work around it | Never in this milestone. Re-implement the 9-source order and pin it with a test that reads the adapter's `getConfigSources` order from a scratch install |
| Add `pi-mcp-adapter` to `devDependencies` for tests | Easy fixtures | Same peer conflict inside `npm ci`. Breaks the "companions pinned only in `scripts/pi.sh`" rule (NFR-5, D-98-10) | Never. Use a scratch `npm install --prefix ... --no-save --ignore-scripts` |
| Verbatim-move `mcp.json` entries in MIGRATE | No plugin source needed | Old name, no `directTools`, no escaping, so a second rewrite follows | Only as the fallback when the plugin clone is gone. The default is a re-stage from the cached plugin source, offline (NFR-5) |
| Mirror the adapter's expansion functions in our tests | Fast, hermetic | Silently drifts from the real adapter | For unit tests only. Pair them with one conformance test against the pinned adapter |
| Version-gate migration via backfill | Reuses machinery | Partial failure is never retried | Never (Pitfall 4) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
| --- | --- | --- |
| Adapter precedence | Assume first-declarer-wins (today's `collision-slots.ts` does, which is MCPSRC-01's inverted direction) | Later sources win, and merging is **per field** (`mergeServerMaps`). `.pi/mcp.json` replaces a global Pi entry whole. `.mcp.json` and `.pi/mcp-adapter.json` beat the user `mcp-adapter.json` we write. `claudePlugins` defaults, `pi.mcp` package entries and agent plugins sit below |
| Exclusive mode and `--mcp-config` | Assume `<agentDir>/mcp-adapter.json` is always read | `PI_MCP_CONFIG_MODE=exclusive` reads only the global file. `--mcp-config <path>` replaces it. Document both. Do not parse `process.argv` |
| Pi's `mcp.json` during FLOOR→DELIVER | Leave the interim unexamined | On Pi 1.0 + adapter 5, our `mcp.json` entries load through translation, with a `_piClaudeMarketplace` "Ignored settings" warning every start, and SSE skipped. Usable but noisy. No release in that window |
| `registerMcpServer` | Use it to avoid file writes | Adapter 5 treats runtime registrations as proxy-only (`direct`/`deferred` ignored), so `directTools: "search"` cannot work. That is why the milestone writes the file |
| Pi's built-in MCP | Count it as satisfying the MCP soft dep | Out of scope by decision. A missing adapter shows `{requires pi-mcp}` even when the built-in runs |
| `MCP_DIRECT_TOOLS` env | Assume `directTools: "search"` always applies | The adapter's env override (`parseEnvDirectToolOverride`, `__none__`) can override per-server settings. Mention it in docs |
| Symlinked config files | Assume NFR-10's `assertPathInside` guards the real write | `write-file-atomic` follows `realpath`, as the adapter's `writeConfigText` does. A dotfiles symlink is written through. Decide whether the check runs on the real path |
| pi-subagents 0.74 / engine 3.13.1 | Assume peer ranges accept Pi 1.0 | Checked: pi-subagents 0.74.0 peers `pi-coding-agent: "*"`, engine 3.13.1 peers `>=0.80.8`, both fine. Re-run the engine canaries on 1.0 anyway. Open ledger 84 (engine subagents get no tools) is still unexplained |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
| --- | --- | --- | --- |
| A rename invalidates every cache entry, and adapter 5 discovers missing ones at startup, 10 at a time, spawning each stdio server | The first `/reload` after the upgrade is slow, `npx` servers download, HTTP servers ask for sign-in, and search tools are absent until discovery ends | Say so in the migration message. Rename once | Users with 10+ plugin MCP servers |
| Rewriting `mcp-adapter.json` on every reconcile (unstable key order, or env-driven re-render) | Approval prompts on every `/reload` for project servers. mtime churn, cache misses | Write only when bytes change. Keep key order stable | Any project-scope plugin with MCP |
| Pi 1.0 brings many new packages (`pi-server`, `pi-client`, `chord`, `pi-codemode`, `pi-mcp`) | Slower `npm ci`. Lint job near its 10-minute cap (memory) | Watch CI timings after FLOOR | Cold CI caches |

## Security Mistakes

| Mistake | Risk | Prevention |
| --- | --- | --- |
| Persisting resolved `${VAR}` values | Tokens written into `mcp-adapter.json`, and committed to git at project scope | Never persist env values (Pitfall 8) |
| Passing `${ANTHROPIC_API_KEY}` and the other deny-listed credentials through `url` and `headers` | A plugin sends the user's model or cloud key to a server it chose. Claude Code blocks this | Apply the deny-list at write time. Test it |
| A literal leading `!` in plugin `env` or `headers` | Runs as a shell command under the adapter, while Claude Code treats it as a plain string. Not an escalation (hooks can already run code), but invisible at install | Escape with `!!`, or warn (MENVX-01) |
| Cleaning up adapter caches, tokens or approvals after a rename | Writes outside the NFR-10 set. Risk of deleting the user's credentials | Do not touch them. Document instead |
| Moving a project-scope `.pi/mcp.json` entry | Teammates on an older extension version add it back to `mcp.json`, so the files flip between versions | Document a version floor for teams sharing `.pi/` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
| --- | --- | --- |
| A silent rename | Hook matchers, `mcp:<server>` agent overrides, `allowedServers` and sign-ins break with no explanation | One migration notice: `old -> new` per server, what needs re-doing, and the second `/reload` hint |
| `info` reads "not connected" for a lazy server | Looks broken | Words that show a resting state, with `cached` and `not-connected` distinct from `failed` and `needs-auth` |
| The adapter's per-start "Ignored settings: _piClaudeMarketplace" warning before migration | Users think our extension corrupted their file | Migrate on the first reload, and mention it in the CHANGELOG |
| Comments dropped from a hand-edited `mcp-adapter.json` | Lost notes | Warn once, or preserve (Pitfall 1) |
| `/mcp-adapter disable` undone by `update` | User intent lost | Carry overlay fields forward (Pitfall 3) |

## "Looks Done But Isn't" Checklist

- [ ] **DELIVER:** a fixture with comments, a trailing comma, a BOM and the `mcp-servers` alias round-trips with every foreign entry and top-level key intact.
- [ ] **DELIVER:** a marker-less `{ "disabled": true }` stub in the project `.pi/mcp-adapter.json` does not block a user-scope update.
- [ ] **DELIVER:** `directTools: "search"` tools can be reached through Pi's `tool_search` on real Pi 1.0 with `builtin:tool-search` loaded. Checked after discovery fills `mcp-cache.json`, not before.
- [ ] **DELIVER:** the NFR-10 write set, `persistence/locations.ts`, `persistence/README.md`, AGENTS.md's Containment line and the `config-state-write-seams` gate all name `mcp-adapter.json`. New gate-referenced files are registered in `tests/architecture/gate-targets.ts` (D-07-06).
- [ ] **NAME:** the 64-character tool-name behavior was measured on Pi 1.0, not assumed.
- [ ] **NAME:** a `-`/`_` folding collision is refused at install, before any write (RN-3).
- [ ] **VARS:** a conformance test runs every escape case through the pinned adapter's real functions.
- [ ] **VARS:** no fixture or test output contains a resolved secret value.
- [ ] **MIGRATE:** a fault injected between "add" and "remove" converges on the next `/reload`, with no duplicate servers left.
- [ ] **MIGRATE:** state, `mcp.json` and `mcp-adapter.json` agree after a crash at each step. The hub-split warning in memory applies: assert order and call counts, not only the end state.
- [ ] **DETECT:** a third-party `mcp` tool, and an adapter running with `disableProxyTool`, are both classified correctly.
- [ ] **STATUS:** a snapshot published before our subscription, and the empty shutdown snapshot, are both handled.
- [ ] **FLOOR:** the pi-subagents floor tests ran with zero skips against 0.74.0 in a scratch prefix, and the Stop canary ran on 1.0.
- [ ] **FLOOR:** `scripts/pi.sh` pins adapter 5.0.0, pi-subagents 0.74.0 and engine 3.13.1.
- [ ] **ALL:** `npm run check` ran unpiped, with `CHECK_EXIT` written to the log (memory: green runs that checked nothing).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
| --- | --- | --- |
| A user's `mcp-adapter.json` wiped (Pitfall 1) | HIGH | No backup exists. Before the first write to a file we did not create, keep a sibling `.bak`. A user-visible file justifies the copy |
| Duplicate servers after a half migration | LOW | The fixed-point pass removes the `mcp.json` copy on the next `/reload` |
| Lost sign-ins after the rename | LOW (per server) | Sign in again with `/mcp-adapter`. The notice lists which servers |
| Wrong name builder shipped | HIGH | A second rename repeats every Pitfall 6 cost. Measure first (Pitfall 9) |
| Pins broken by a merge | LOW | Remap from the pre-merge revision once, as the memory notes describe |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
| --- | --- | --- |
| 1 JSONC wipe | DELIVER | Round-trip fixture. Refusal test for unparseable input |
| 2 `mcp-servers` alias | DELIVER | Alias fixture |
| 3 Adapter overlays | DELIVER, MIGRATE | Planted stub and panel-copy tests |
| 4 Half migration | MIGRATE | Fault injection between writes. Lock-order test |
| 5 Two-reload convergence | MIGRATE, DOCS | Live UAT counts reloads. Notice carries the reload hint |
| 6 Rename orphans | NAME, MIGRATE, DOCS | The notice lists renames. Bytes stable across reloads |
| 7 Second expansion | VARS | Per-field conformance against the pinned adapter |
| 8 Secret persistence and deny-list | VARS | Security tests. Phase threat model |
| 9 Name collisions, length, hooks | NAME | Long and hyphenated fixtures. Measured length behavior |
| 10 Probe false positives and negatives | DETECT | Four-state unit tests plus a real-Pi RPC run |
| 11 Status stream | STATUS | Pre-subscribe and shutdown snapshot tests. RPC check |
| 12 features/mcp replay | FLOOR | Zero-skip floor run. Re-derived pins. Restored README sections |
| 13 Dev and CI environment | FLOOR, DELIVER, DOCS | Launcher pins. Sandboxed agent dir. Tool-search check |

## Sources

- `pi-mcp-adapter@5.0.0` tarball, read in source: `config.ts` (`getConfigSources`, `mergeServerMaps`, `readPiMcpConfig`, `translatePiMcpServer`, `writeProjectServerDisabledOverride`, `writeDirectToolsConfig`, `setServersObject`), `utils.ts` (`parseJsonWithComments`, `interpolateEnvVars`, `resolveCommandSecret`, `expandHomePath`, `resolveServerUrl`), `server-manager.ts` (`resolveEnv`, stdio and HTTP field resolution), `types.ts` (`formatServerNamespace`, `formatToolName`, `ServerEntry`, the status types), `direct-tool-surface.ts`, `metadata-cache.ts`, `mcp-auth.ts`, `project-server-trust.ts`, `mcp-status.ts`, `pi-builtin-mcp.ts`, `index.ts`, `CHANGELOG.md`, `docs/configuration.md`. HIGH.
- `@earendil-works/pi-coding-agent@1.0.0` tarball: `CHANGELOG.md`, `dist/core/extensions/types.d.ts` (`ToolInfo.exposure`, `ResourcesDiscoverEvent` at 524-534, "Fired after session_start"), `dist/extensions/mcp/*`, `package.json` (pi-ai `^1.0.0`, node `>=22.19.0`). HIGH.
- `features/mcp` branch (`git show features/mcp:.planning/phases/...`): 01-01 and 01-02 SUMMARY, 01-05 SUMMARY, 01-REVIEW, 01-REVIEW-FIX, 01-REVIEW-DISPOSITION, 01-VERIFICATION, 02-CONTEXT, 02-REVIEW, 03-CONTEXT, and `.planning/spikes/028-pi-099-builtin-mcp/README.md` (Setup, Tool names, Consequences). HIGH.
- Current tree: `bridges/mcp/{stage,unstage,marker,substitute}.ts`, `platform/pi-api.ts`, `orchestrators/reconcile/backfill.ts`, `scripts/pi.sh`, `scripts/check-unused-type-members.contracts.json`, `tests/integration/provenance-invisibility.test.ts`, `.planning/BACKLOG.md` (MCPSRC-01, ENVLIT-01, MENVX-01, ENVDOC-01, CFGDIR-01). HIGH.
- code.claude.com/docs/en/mcp (WebFetch): `${VAR}` / `${VAR:-default}` fields, unset-variable behavior, the credential deny-list, plugin naming `plugin:<plugin>:<server>` and `mcp__plugin_<plugin>_<server>__<tool>`, tool search on by default. Official docs; the research seam tiers WebFetch as LOW. The naming matches the features/mcp binary grep (Claude Code 2.1.285/2.1.287).
- `npm view`: pi-subagents 0.74.0 peers, `@quintinshaw/pi-dynamic-workflows@3.13.1` peers, adapter dist-tag `latest` = 5.0.0. HIGH.
- Project memory notes: source-walk gates follow code, contracts pins are line:col and merge-fragile, Prettier invalidates pins, pi-subagents tests use the global peer, green runs that checked nothing, the hub-split sequence-assertion loss, notify is a dumb renderer.

---
*Pitfalls research for: mcp-4 (Pi 1.0 baseline + pi-mcp-adapter 5 delivery)*
*Researched: 2026-10-01*
