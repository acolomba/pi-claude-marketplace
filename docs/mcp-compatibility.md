# MCP compatibility

This document compares how Claude Code and this extension run the MCP servers of a Claude plugin. It covers names, tool search, the length of tool names, the connection lifecycle, the translation of each server field, and the places where the two products differ.

Legend: `✓` supported, `✗` not supported, `⚠` partial (see notes), `--` no equivalent on that side.

The Claude Code column reflects the MCP reference at [code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp) and the server schemas in the Claude Code 2.1.291 binary. The row for `_meta["anthropic/alwaysLoad"]` was checked later, on the 2.1.294 binary. The Pi column reflects pi-mcp-adapter 5.2.0 on Pi 1.0.0 and the sources under `extensions/pi-claude-marketplace/bridges/mcp/` and `extensions/pi-claude-marketplace/domain/`. Statements about run-time behavior come from two runs. The first is a measurement on 2026-10-06. That measurement ran a real Pi 1.0.0 with pi-mcp-adapter 5.0.0 in a sandbox, with a local test MCP server and a stub model provider that logged each request. The second is the live canary `tests/live-uat/mcp-adapter-canary.mjs`, which ran pi-mcp-adapter 5.2.0 on Pi 1.0.0 and recorded its result on 2026-10-09.

This extension does not run MCP servers itself. It writes one entry for each plugin server into the `mcp-adapter.json` file of the install scope: `~/.pi/agent/mcp-adapter.json` for the user scope, `<project>/.pi/mcp-adapter.json` for the project scope. pi-mcp-adapter reads that file and runs the servers. Earlier releases of this extension wrote these entries into the `mcp.json` file of the scope. `/reload` moves them into `mcp-adapter.json`. See [Upgrading](#upgrading).

This extension needs pi-mcp-adapter 5.2.0 or a later 5.x release. pi-mcp-adapter 5.2.0 moves the MCP SDK from 2.0.0 to 2.3.1, which fixes the security advisory GHSA-6qxp-vccf-f47h. With the SDK 2.0.0, a malicious or compromised MCP server could point a sign-in at its own authorization server. It then received the refresh token and the client secret that an earlier sign-in saved. Since 5.2.0, pi-mcp-adapter does not follow a server URL that redirects to another host, so a plugin server with such a URL does not connect. A redirect from `http` to `https` on the same host still works.

## Server and tool names

Claude Code registers a plugin server under the name `plugin:<plugin>:<server>`. The model sees each tool of that server as `mcp__plugin_<plugin>_<server>__<tool>`. To make a name, Claude Code replaces every character outside `A-Z`, `a-z`, `0-9`, `_` and `-` with `_` (ANAME-01).

This extension gives the tools the same names. It applies the same rule to `plugin:<plugin>:<server>` and adds a `_` at the end. The result is the key of the server entry in `mcp-adapter.json`. Every entry also gets `toolPrefix: "mcp"`. With this key and this prefix, pi-mcp-adapter names each tool `mcp__plugin_<plugin>_<server>__<tool>`, the name that Claude Code uses. The `_` at the end of the key gives the `__` between the server name and the tool name.

| Plugin | `mcpServers` key | Key in `mcp-adapter.json` | Tool names                      | Name shown by `info` |
| ------ | ---------------- | ------------------------- | ------------------------------- | -------------------- |
| `foo`  | `api`            | `plugin_foo_api_`         | `mcp__plugin_foo_api__<tool>`   | `plugin:foo:api`     |
| `foo`  | `my.db`          | `plugin_foo_my_db_`       | `mcp__plugin_foo_my_db__<tool>` | `plugin:foo:my.db`   |
| `bar`  | `api`            | `plugin_bar_api_`         | `mcp__plugin_bar_api__<tool>`   | `plugin:bar:api`     |

`/claude:plugin info` shows each server by its Claude Code name, `plugin:<plugin>:<server>`, with the server name exactly as the plugin declares it. The pi-mcp-adapter panel and commands, such as `/mcp-adapter disable`, show and accept the key, with its `_` at the end. pi-subagents `mcp:` entries also use the key.

Two plugins can declare servers with the same name. Their keys usually differ, because each key holds the plugin name. A pair of servers whose names give the same key is refused like any other collision. For example, `plugin:a_b:c` and `plugin:a:b_c` both give the key `plugin_a_b_c_`.

An install, update, or reinstall fails if the new key is equal to the key of another server, and it leaves nothing behind: the command rolls back every component that it already wrote. The other server can belong to the same plugin, to another plugin, or to any MCP configuration that pi-mcp-adapter reads. Pi groups the tools of a server under a name in which every `-` of the key becomes `_`. So the install also fails if the two keys are equal after every `-` becomes `_`, for example `plugin_foo_my-db_` and `plugin_foo_my_db_`. Claude Code runs these two servers side by side. This refusal applies only to Pi (ANAME-03). See [Divergences and documented absences](#divergences-and-documented-absences).

## Tool search

| Feature                                   | Claude Code | Pi  | Notes                                                                             |
| ----------------------------------------- | ----------- | --- | --------------------------------------------------------------------------------- |
| Tools load on demand through a search     | ✓           | ✓   | Pi: through the `mcp` tool of pi-mcp-adapter                                      |
| `alwaysLoad: true` keeps tools in context | ✓           | ✓   | written as `directTools: true`                                                    |
| `_meta["anthropic/alwaysLoad"]` on a tool | ✓           | ✗   | each tool follows the setting of its server                                       |
| Pi's own `tool_search` tool               | --          | ⚠   | off by default. Turn it on with `"defaultTools": ["+tool_search"]` in Pi settings |

Claude Code keeps MCP tools out of the prompt by default and finds them through its tool search. A server with `alwaysLoad: true` keeps all its tools in the prompt.

This extension writes `directTools: "search"` on every entry, so pi-mcp-adapter keeps the tools out of the first request to the model. A server with `alwaysLoad: true` gets `directTools: true`, so its tools are in every request (ANAME-04).

Claude Code 2.1.294 also reads `_meta["anthropic/alwaysLoad"]` on each tool that a server reports. A tool with the value `true` stays in the prompt, even when its server is deferred. Under a server with `alwaysLoad: true`, a tool with the value `false` stays deferred. pi-mcp-adapter ignores the `_meta` of a tool, and this extension writes the entry before any tool list is known. So each tool follows the setting of its server: a tool that asks to stay in the prompt loads on demand like the other tools of its server.

The model finds a tool through the `mcp` tool of pi-mcp-adapter. A call such as `mcp({ search: "query a database" })` searches the tools of all servers and activates each tool that matches. From the next request on, the model sees each activated tool by its full name, such as `mcp__plugin_foo_api__query`, and calls it directly.

Pi also has its own `tool_search` tool. It is off by default, and pi-mcp-adapter does not turn it on. If you want the model to use it, add this setting to your Pi settings file, `~/.pi/agent/settings.json` or `<project>/.pi/settings.json`:

```json
{
  "defaultTools": ["+tool_search"]
}
```

This extension never edits Pi settings files. The choice to add this setting is yours.

If you start Pi with `--no-extensions`, Pi also leaves out its built-in `tool_search`, even with this setting. To keep it, also pass `-e builtin:tool-search`. The live canary measured both cases on Pi 1.0.0.

## Name length

Claude Code does not shorten MCP tool names and does not check their length when it installs a plugin. This extension does the same: no install-time length check exists (ANAME-03).

The measurement of 2026-10-06 showed that Pi and pi-mcp-adapter do not limit the length of these names either. Pi 1.0.0 with pi-mcp-adapter 5.0.0 registered tools with names of 64, 65, 80 and 136 characters. It sent all of them to the model provider, and it ran the 136-character tool when the model called it. Pi's built-in MCP support shortens names that are longer than 64 characters, but pi-mcp-adapter turns that built-in support off.

The limit is in the model provider:

- OpenAI accepts function names of at most 64 characters.
- Anthropic accepts tool names that match `^[a-zA-Z0-9_-]{1,128}$`, so at most 128 characters.

A long plugin name and a long server name can make a tool name that a provider refuses. The provider then rejects the request. The measurement did not send an over-long name to a real provider, so this document does not record the exact error. To find the length of a tool name, add the lengths of `mcp__plugin_`, the plugin name, `_`, the server name, `__`, and the tool name.

## Connection lifecycle

Claude Code connects to the MCP servers of plugins in the background when a session starts. It keeps the connections for the whole session.

This extension never writes `lifecycle` on an entry, so pi-mcp-adapter uses its default, `lazy` (ANAME-05). In this mode, when Pi starts, the adapter starts only a server for which it holds no valid cached list of tools. It reads the list, saves it, and stops the server. The adapter starts the server again when the model uses one of its tools, and stops it again after a period with no use. A server with a valid cached list does not start until the model first uses one of its tools. Until that first use, `/claude:plugin info` can show `status unknown`. See [Server status in info](#server-status-in-info).

Thus the first call to a tool of a stopped server waits while the server starts. A server that keeps data in memory loses that data when the adapter stops it. You can change the mode of one server: set `lifecycle` on its entry yourself. This extension keeps that field when it updates or reinstalls the plugin.

## Project-scope servers

A project-scope plugin writes its servers into `<project>/.pi/mcp-adapter.json`. pi-mcp-adapter treats every server from a project file as a project server, and it owns the trust rules for these servers:

- In a project that Pi does not trust, pi-mcp-adapter blocks the server.
- In a trusted project, an interactive session asks whether to allow the server when the adapter loads it, first at the `/reload` after the install. The first choice, `Don't allow`, is the default. pi-mcp-adapter does not remember `Don't allow`, so it asks again at each load until you allow the server.
- pi-mcp-adapter keeps each approval for the exact entry, so it asks again after an update that changes the entry. An update of a plugin from its own git source changes the entry of each stdio server when the commit changes, because the plugin moves to a new clone directory.
- A headless session, such as a print, JSON or RPC session, skips a server that is not approved. There is one exception: when the user-global configuration of pi-mcp-adapter sets `settings.projectServers` to `allow`, a headless session in a trusted project runs the server without an approval. pi-mcp-adapter ignores this setting in a project file.

While a server waits, `/claude:plugin info` shows `pending approval` for it. This extension never writes the approval files of pi-mcp-adapter (NFR-10). For the full rules, see [Project server trust](https://github.com/nicobailon/pi-mcp-adapter/blob/main/docs/configuration.md#project-server-trust) in the pi-mcp-adapter docs.

Claude Code never asks for approval of a plugin server. It asks only for the servers of a project `.mcp.json` file.

## pi-mcp-adapter settings that change plugin servers

Three settings of pi-mcp-adapter change which plugin servers load, or how their tools reach the model:

- `PI_MCP_CONFIG_MODE=exclusive`: pi-mcp-adapter reads only its user file, `~/.pi/agent/mcp-adapter.json` or the file of `--mcp-config`. Project-scope plugin servers do not load. The adapter also skips the other sources that it reads by default, such as Pi's `mcp.json` files, imported configurations, and the files of parent directories.
- `--mcp-config <file>`: pi-mcp-adapter reads this file in place of `~/.pi/agent/mcp-adapter.json`. User-scope plugin servers do not load. The adapter still reads the project files, so project-scope plugin servers still load.
- `MCP_DIRECT_TOOLS=<server>[/<tool>],...`: this variable replaces the `directTools` value of every entry. The tools of a server that it names are always in the prompt. A server that it does not name gets no tools in the prompt and no tools from a search. `__none__` names no server. The model still reaches every configured server through the `mcp` tool.

This extension does not read these settings and does not warn about them. For the file layout and the settings of pi-mcp-adapter, see its [configuration docs](https://github.com/nicobailon/pi-mcp-adapter/blob/main/docs/configuration.md).

## Translated fields

This extension builds each entry from a closed table. It writes only the fields below, and only when the plugin's value has the type that Claude Code accepts (ANAME-06, ANAME-07).

| Claude Code field             | Server types | pi-mcp-adapter field          | Rule                                                                                                                                                                      |
| ----------------------------- | ------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type` absent or `"stdio"`    | stdio        | --                            | Not written. pi-mcp-adapter starts a stdio server from `command`.                                                                                                         |
| `type: "http"`                | remote       | --                            | Not written, and `httpTransport` stays unset. pi-mcp-adapter uses its default HTTP transport. `"streamable-http"` is the same type.                                       |
| `type: "sse"`                 | remote       | `httpTransport: "sse"`        |                                                                                                                                                                           |
| `command`                     | stdio        | `command`                     | Copied, with its variables rewritten. See [Variables](#variables).                                                                                                        |
| `args`                        | stdio        | `args`                        | Copied, with its variables rewritten. See [Variables](#variables).                                                                                                        |
| `env`                         | stdio        | `env`                         | Copied, with its variables rewritten. See [Variables](#variables). This extension adds the plugin variables. See [Environment variables](env-vars.md).                    |
| `url`                         | remote       | `url`                         | Copied, with its variables rewritten. See [Variables](#variables).                                                                                                        |
| `headers`                     | remote       | `headers`                     | Copied, with its variables rewritten. See [Variables](#variables).                                                                                                        |
| `headers`, no `Authorization` | remote       | `auth: "oauth"`               | Written when no header key is `Authorization`, in any case, and every written value is clean. See [OAuth beside headers](#oauth-beside-headers).                          |
| `timeout`                     | all          | `requestTimeoutMs`            | Written only when it is 1000 or more, because Claude Code ignores a smaller value. A value above 2147483647 becomes 2147483647.                                           |
| `request_timeout_ms`          | http, sse    | `requestTimeoutMs`            | Used only when `timeout` is absent, as Claude Code does. A value above 300000 becomes 300000. Then the rule for `timeout` applies.                                        |
| `alwaysLoad`                  | all          | `directTools`                 | `true` gives `directTools: true`. Any other value, or no value, gives `directTools: "search"`.                                                                            |
| `oauth.clientId`              | remote       | `oauth.clientId`              | Copied.                                                                                                                                                                   |
| `oauth.callbackPort`          | remote       | `oauth.redirectUri`           | Written as `http://localhost:<port>/callback`, the form that Claude Code uses. An OAuth client that you registered for Claude Code with this redirect URI works here too. |
| `oauth.authServerMetadataUrl` | remote       | `oauth.authServerMetadataUrl` | Copied. The value must start with `https://`.                                                                                                                             |
| `oauth.scopes`                | remote       | `oauth.scope`                 | Copied.                                                                                                                                                                   |
| --                            | all          | `toolPrefix: "mcp"`           | Always written. See [Server and tool names](#server-and-tool-names).                                                                                                      |
| --                            | all          | `description`                 | The `description` of the plugin's `plugin.json`, or else the description of its marketplace entry. Not written when neither exists. Claude Code has no such field.        |

pi-mcp-adapter shows the `description` with the server's tools, and both tool searches use it to find them.

The two timeouts do not mean the same thing. In Claude Code, `timeout` is a hard limit on one tool call, in milliseconds. Progress messages from the server do not extend it. If a server sets no `timeout`, Claude Code uses the `MCP_TOOL_TIMEOUT` environment variable, or a default of about 28 hours. In pi-mcp-adapter, `requestTimeoutMs` starts again each time the server reports progress. If an entry has no `requestTimeoutMs`, the default of the MCP SDK applies, which is 60 seconds. This extension does not write a default. So a plugin tool that runs for more than 60 seconds with no progress messages fails under Pi but not under Claude Code. To prevent this, the plugin can set `timeout`, or you can set `requestTimeoutMs` on the entry yourself.

### OAuth beside headers

Claude Code signs in to a remote server with OAuth unless its `headers` hold an `Authorization` key, in any case. Other headers do not turn OAuth off. pi-mcp-adapter turns OAuth off for every server with headers, unless the entry sets `auth: "oauth"`. So this extension writes `auth: "oauth"` for a remote server whose headers hold no `Authorization` key (D-08-04). A server with an `Authorization` header gets no `auth`, so OAuth stays off, as in Claude Code. A server with no headers, or with empty `headers`, gets no `auth` either. pi-mcp-adapter then uses OAuth when the server asks for it, as Claude Code does.

In OAuth mode, pi-mcp-adapter refuses a header that references a variable that is not set or is empty, and a header whose value is empty. So this extension writes `auth: "oauth"` only when every written header value is clean. A clean value references only variables that have a non-empty value at install time, and it is not empty after the spaces at its ends are removed. The split token counts as not clean, because it references a variable with an empty value. The table shows what the install writes for each kind of header value:

| Header value of the plugin                          | Environment at install | Written value                                                     | `auth: "oauth"` written |
| --------------------------------------------------- | ---------------------- | ----------------------------------------------------------------- | ----------------------- |
| `core`                                              | any                    | `core`                                                            | yes                     |
| `${TEAM}`                                           | `TEAM` set             | `${TEAM}`                                                         | yes                     |
| `${TEAM}`                                           | `TEAM` not set         | `${TEAM}`, with the `MCP server variables not set.` warning       | no                      |
| `${TEAM:-acme}`                                     | `TEAM` not set         | `acme`                                                            | yes                     |
| `${ANTHROPIC_API_KEY}`                              | set                    | an empty value, because the credential is withheld                | no                      |
| `Bearer ${ANTHROPIC_API_KEY}`                       | set                    | `Bearer` and a space, which pi-mcp-adapter trims to `Bearer`      | yes                     |
| `${TEAM}_eu`                                        | `TEAM` set             | `${TEAM}{env:PI_CLAUDE_MARKETPLACE_EMPTY}_eu`, with a split token | no                      |
| `${TEAM}-eu`                                        | `TEAM` set             | `${TEAM}-eu`                                                      | yes                     |
| `a{env:X}b`                                         | any                    | `a{env:{env:PI_CLAUDE_MARKETPLACE_EMPTY}X}b`, with a split token  | no                      |
| `!cmd`                                              | any                    | `!!cmd`, from which pi-mcp-adapter removes one `!`                | yes                     |
| only spaces                                         | any                    | the same spaces                                                   | no                      |
| any value, under an `Authorization` key in any case | any                    | the value, rewritten as for any other header                      | no                      |

A server without `auth` connects without OAuth, as before. The OAuth item under Variables in [Divergences and documented absences](#divergences-and-documented-absences) records this gap.

## Dropped fields

This extension drops every other field of a plugin server, with no warning, as Claude Code does. The dropped fields include:

- The Claude Code fields `cwd`, `role`, and `discoveryCache`.
- Every field that only pi-mcp-adapter knows, for example `auth`, `approveTools`, `requestHeadersCommand`, `inheritEnv`, `bearerTokenEnv`, and `lifecycle`. For `auth`, only the plugin's own value is dropped. This extension writes `auth: "oauth"` itself under the rule in [OAuth beside headers](#oauth-beside-headers).
- Every `oauth` field outside the four in the table, for example `clientSecret`.
- Every unknown field.

A plugin that declares `description`, `directTools`, or `toolPrefix` gets the value of this extension instead.

So a plugin cannot give itself a pi-mcp-adapter power that Claude Code does not give a plugin. For example, a plugin cannot send your Pi provider token to its server with `auth`, and it cannot approve its own tools with `approveTools`.

## Partially available plugins

Some MCP server features of Claude Code have no equivalent in pi-mcp-adapter.

| Feature                                                          | Claude Code | Pi  | Notes                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------- | ----------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type: "ws"`                                                     | ✓           | ✗   | pi-mcp-adapter has no WebSocket transport.                                                                                                                                                                                                   |
| `type` `"sse-ide"`, `"ws-ide"`, `"sdk"`, `"claudeai-proxy"`      | ⚠           | ✗   | Claude Code uses these types for connections of its own host, not for plugin servers. pi-mcp-adapter has no such transport.                                                                                                                  |
| `headersHelper`                                                  | ✓           | ✗   | `requestHeadersCommand` of pi-mcp-adapter has a different contract.                                                                                                                                                                          |
| `oauth.xaa` with a true value                                    | ✓           | ✗   | pi-mcp-adapter has no cross-app access flow.                                                                                                                                                                                                 |
| `bareElicitationCapability: true`                                | ✓           | ✗   | pi-mcp-adapter always announces form and URL elicitation, with no switch for one server.                                                                                                                                                     |
| A leading `~`, `~/` or `~\` in `command` or in an `args` element | ✓           | ✗   | Claude Code passes the value as written. pi-mcp-adapter replaces a leading `~` with your home directory after it expands variables, so no written form stays literal. A leading `${NAME:-default}` whose default starts that way counts too. |

If a server of a plugin uses one of these features, the plugin is `(partially-available)` with the reason `{unsupported mcp}`. A normal install refuses the plugin and suggests `--partial`. With `--partial`, the install writes every other component and every other server. It leaves out each affected server completely. The installed plugin then shows `(partially-installed)`. `/claude:plugin info` names each server that the install leaves out, with the feature that blocks it, for example `plugin:db-tools:live (unsupported ws)`. A leading home marker shows as `(unsupported command ~)` or `(unsupported args ~)`. The agents of the plugin get no tools from a server that the install leaves out.

## Tool permission rules

The schema of Claude Code lets a remote server declare `tools[].permission_policy` and `toolPermissions`. These fields allow, ask about, or block single tools of the server. pi-mcp-adapter has no rule for each tool. Its `approveTools` field belongs to the user.

So this extension installs such a server, and the server works, but the rules are not enforced. The written entry has neither field, and the tools of the server run without these rules. Install, update, reinstall, enable, import, reconcile, and the move on `/reload` show the warning `MCP server tool rules not enforced.` The warning names the server and the fields. It does not name the tools or the values (ANAME-07). An empty `toolPermissions` holds no rule and gets no warning. It is not known whether Claude Code enforces these rules for the servers of a plugin. For the exact notice, see [MCP server tool rules not enforced](output-catalog.md#mcp-server-tool-rules-not-enforced-aname-07).

## Invalid server configs

A server config that the schema of Claude Code rejects is malformed. Examples are an unknown `type`, a `url` with no `type`, a `timeout` that is not a positive integer, and a `callbackPort` outside 1 to 65535. If a plugin has a malformed server, the whole plugin is `(unavailable)` with the reason `{malformed mcp}`, and no part of it installs. Claude Code skips only that server, shows an error, and loads the other servers of the plugin.

## User overrides

You can change a plugin server's entry in `mcp-adapter.json` yourself. This extension keeps your values of these fields: `disabled`, `approveTools`, `includeTools`, `excludeTools`, `lifecycle`, `idleTimeout`, `requestTimeoutMs`, `debug`, `searchKeywords`, `openUi`, and `trace`. Your values survive an update, a reinstall, a plugin disable then enable, and an uninstall then reinstall (D-08-01, D-08-02).

While the server is not installed, this extension keeps your values in the same `mcp-adapter.json`, under the top-level member `_piClaudeMarketplace.serverChoices`. This happens when you disable or uninstall the plugin, and when an update drops the server. pi-mcp-adapter ignores this member. Each stored choice records the server key, the plugin name, and the marketplace name. When the same plugin from the same marketplace writes the server again, your values go back into its entry and leave the store. A stored choice never applies to a server of another plugin, even one with the same key. It also never applies to a plugin with the same name from another marketplace.

`/mcp-adapter disable` writes its choice into the project file, `<project>/.pi/mcp-adapter.json`, whatever the scope of the server. So for a user-scope plugin, that choice already lives outside the plugin's entry, and it applies only in that project. For a project-scope plugin, the choice lands in the plugin's entry, and the store above keeps it. The store also keeps the values that you write into an entry yourself, in either scope.

One exception exists. If the plugin's own entry sets one of these fields, the plugin owns that field. Today this applies only to `requestTimeoutMs`, which comes from the server's `timeout`. An update or a reinstall then writes the plugin's value, not yours. This matches Claude Code, where a user cannot change the timeout of a plugin server.

You can also write an override before the install: an entry under the server's key with no `command` and no `url`. The install keeps that override inside the plugin's entry. If the plugin sets a field of the override, that field stops applying, and the install shows a warning that names the field. If a later version of the plugin stops setting the field, your value applies again. When you uninstall or disable the plugin, this extension writes your override back, with your own value of each field that the plugin set. For the exact notice and the full list of commands that write the override back, see [MCP server override kept](output-catalog.md#mcp-server-override-kept-afile-06).

## Hooks and agents

Plugin hooks see MCP tools by their Claude Code names (ANAME-02). The matcher `mcp__plugin_foo_api__query` fires for that tool, and `mcp__plugin_foo_api__.*` fires for every tool of the server. `if` predicates work the same way. See [Tool name mapping](hooks-compatibility.md#tool-name-mapping).

A call that the model makes through the `mcp` tool of pi-mcp-adapter, such as `mcp({ tool: "mcp__plugin_foo_api__query" })`, reaches hooks as tool `mcp`. The plugin's MCP matchers and `if` predicates do not fire for that call. A direct call to an activated tool fires them as usual.

A `tools:` entry of a plugin agent that names one of the plugin's own MCP tools becomes a pi-subagents `mcp:` entry. For example, `mcp__plugin_foo_api__query` becomes `mcp:plugin_foo_api_/query`. pi-subagents runs MCP tools only in background launches, so such an agent needs `async: true`. See [Customizing generated agents](../README.md#customizing-generated-agents).

pi-subagents compares the tool part of an `mcp:` entry with the exact tool names that the server reports. If the server reports no tool with exactly that name, pi-subagents does not start the agent: the whole launch fails, not only that tool. This happens when the server renames or removes the tool, when the agent misspells the tool name, and when the tool name holds a character that Claude Code replaces, such as `.` or a space, because then the Claude Code form of the name does not match. To avoid this, give the agent the whole server: name `mcp:plugin_<plugin>_<server>_` in the `tools` of a pi-subagents agent override. See [Customizing generated agents](../README.md#customizing-generated-agents).

## Variables

A plugin server can reference environment variables as `${NAME}` or `${NAME:-default}`. Claude Code expands them when it loads the server. pi-mcp-adapter expands variables too, but with different rules. This extension rewrites each value at install time, so that pi-mcp-adapter gives the server the value that Claude Code gives it (AVAR-01, AVAR-02, AVAR-03). The install writes no environment value into `mcp-adapter.json`.

### Where variables expand

Claude Code expands variables in five fields only: the `command`, `args` and `env` values of a stdio server, and the `url` and `headers` values of a remote server. This extension uses the same five fields. It keeps every other field as literal text, for example the `oauth` fields, the `description`, and the keys of `env` and `headers`. The `env` values under the keys `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` also stay literal, as in Claude Code.

Three variables expand at install time:

- `${CLAUDE_PLUGIN_ROOT}` becomes the directory of the plugin.
- `${CLAUDE_PLUGIN_DATA}` becomes the data directory of the plugin in the install scope.
- `${CLAUDE_PROJECT_DIR}` becomes the project directory, at project scope only. For the user scope, see [The project directory at user scope](#the-project-directory-at-user-scope).

Each stdio server also gets `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` in its `env`, as in Claude Code. If the plugin declares a value under one of these keys, the plugin's value wins.

### Other variables

For every other variable, this extension applies the rule of Claude Code at install time:

- `${NAME}` stays `${NAME}`. pi-mcp-adapter expands it from the environment of Pi when it starts the server.
- `${NAME:-default}` becomes `${NAME}` if `NAME` is set at install time, also when its value is empty. If `NAME` is not set, the install writes the default text.

Thus a value from your environment reaches the server only through pi-mcp-adapter, when it starts the server.

If a referenced variable is not set at install time and has no default, the install shows the warning `MCP server variables not set.`. The warning names the server and the variables. The install still writes the server.

### Syntax that only pi-mcp-adapter knows

pi-mcp-adapter also expands `$env:NAME` and `{env:NAME}`. It runs a value that starts with `!` as a shell command. It replaces a leading `~` in `command` and `args` with your home directory. Claude Code does none of these things. This extension writes each value so that pi-mcp-adapter outputs the literal text of Claude Code:

- Text such as `$env:NAME`, `{env:NAME}`, or a `${...}` form that Claude Code does not expand, such as `${1X}`, gets a split token. The split token is a reference to the empty variable `PI_CLAUDE_MARKETPLACE_EMPTY`. For example, `{env:NAME}` is written as `{env:{env:PI_CLAUDE_MARKETPLACE_EMPTY}NAME}`. pi-mcp-adapter replaces the inner reference with an empty string, so it outputs `{env:NAME}`.
- A kept `${NAME}` also gets a split token where the text beside it could join with its value into `$env:NAME` or `{env:NAME}`. The token goes in front of the reference if the text before it ends in `$`, `{`, or the start of `$env` or `{env`, such as `$en`. The token goes after the reference if the text after it starts with an ASCII letter, a digit, `_` or `}`, or with a `:` before an ASCII letter, a digit or `_`. For example, `${PREFIX}env:ANTHROPIC_API_KEY` is written as `${PREFIX}{env:PI_CLAUDE_MARKETPLACE_EMPTY}env:ANTHROPIC_API_KEY`. Without the token, a value of `PREFIX` that ends in `$` would make pi-mcp-adapter send the value of `ANTHROPIC_API_KEY` to the server, although Claude Code withholds it. Common values such as `${HOST}:8080` and `${NAME}_suffix` also get the token. Values such as `Bearer ${TOKEN}`, `https://${HOST}/mcp`, and `${USER}:${PASSWORD}` do not.
- A leading `!` in an `env` or `headers` value is written as `!!`. pi-mcp-adapter removes one `!`, and it runs no command.
- A leading `~` in `command` or `args` cannot stay literal. Such a server makes the plugin partially available. See [Partially available plugins](#partially-available-plugins).

This extension reserves the variable `PI_CLAUDE_MARKETPLACE_EMPTY`. It sets the variable to the empty string in the process of Pi when it loads and at each session start. The variable must stay set, because pi-mcp-adapter refuses a server whose `url` references a variable that is not set.

### The project directory at user scope

A user-scope entry keeps `${CLAUDE_PROJECT_DIR}`. This extension sets `CLAUDE_PROJECT_DIR` in the process of Pi to the working directory of the session, when it loads and at each session start. pi-mcp-adapter then expands the reference to the current project when it starts the server. Claude Code also uses the current project, at every scope. The install does not report this variable as not set.

If the directory name holds `$env:` or `{env:`, this extension does not set the variable, because pi-mcp-adapter would expand that text again. The same applies if the directory name ends in `$`, `{`, or the start of `$env` or `{env`, such as `$en`. The plugin text after `${CLAUDE_PROJECT_DIR}` can complete such an ending into `$env:NAME` or `{env:NAME}`, and pi-mcp-adapter would then send the value of `NAME` to the server, even a withheld credential. The install now writes a split token after a kept reference wherever the text after it could do this, so this second check protects entries written before the install did so: legacy `mcp.json` entries that the move on `/reload` has not yet rewritten. In both cases this extension also removes any earlier value of the variable from the process of Pi, so a server does not get the wrong project. pi-mcp-adapter then refuses a `url` that references the variable, and it expands the reference to an empty value in the other fields. A debug-log line records the skip.

### Withheld credentials

Claude Code never gives some credentials to a plugin server. This extension applies the deny-list of Claude Code 2.1.291 (AVAR-05). It compares names without regard to case.

- The plain list applies in all five fields. It holds the tokens and session secrets of Claude Code, the `OTEL_*` variables, and the `INPUT_` forms of some of these names.
- The remote list applies only to `url` and `headers`, the fields that go to a remote server. It adds cloud, CI, package registry, proxy and webhook credentials, for example `ANTHROPIC_API_KEY`. It also covers the name patterns `GIT_CONFIG_*` and `CARGO_REGISTRIES_*_TOKEN`. A provider base URL such as `ANTHROPIC_BASE_URL` is withheld only when its value holds a credential, for example a password in the URL. This extension checks that value at install time.

`GITHUB_TOKEN` and `GH_TOKEN` are on neither list, so a server receives them, as in Claude Code. `ANTHROPIC_API_KEY` is withheld only from `url` and `headers`. A stdio server gets it through `command`, `args` or `env`, as in Claude Code.

The install never leaves a withheld reference for pi-mcp-adapter. So a value that you set later cannot reach the server:

- In `url` and `headers`, a withheld reference is written as an empty value. A `:-` default does not apply.
- In the other fields, a withheld reference is written as an empty value if the variable is set at install time. If it is not set, the install writes the default. With no default, it writes the literal text `${NAME}` and shows the `MCP server variables not set.` warning.

If a withheld variable in `url` or `headers` is set at install time, the install shows the warning `MCP server credentials withheld.`. The warning names the server and the variables. It never shows their values.

### Warnings and info

Each command that writes the entries of a plugin shows the two warnings after its own rows (AVAR-04). These commands are `install`, `update`, `reinstall`, `enable`, `import`, and the install that `/reload` runs for a plugin that a configuration file declares. For the exact text, see [MCP server variables not set](output-catalog.md#mcp-server-variables-not-set-avar-04) and [MCP server credentials withheld](output-catalog.md#mcp-server-credentials-withheld-avar-05).

`/claude:plugin info` shows the same facts for the current environment. Its `mcp:` line lists, for each server, the variables that are not set and have no default, and the credentials that it withholds. An example is `plugin:analytics:api (unset ANALYTICS_TOKEN; withheld ANTHROPIC_API_KEY)`. The line shows names only.

### Proof against pi-mcp-adapter

The rewrite depends on how pi-mcp-adapter expands values. A conformance test runs each expansion case through the functions of pi-mcp-adapter 5.2.0 and compares the output with the value of Claude Code. CI installs that exact version and runs the test with no skipped cases. The peer range of this extension for pi-mcp-adapter is `>=5.2.0 <6`.

## Upgrading

Earlier releases of this extension wrote each plugin server into the `mcp.json` file of the install scope, under the name that the plugin declares. On the first start or `/reload` after the upgrade, this extension moves the servers of each installed plugin from `mcp.json` into the `mcp-adapter.json` file of the same scope. It shows one notice that starts with `Plugin MCP servers moved from mcp.json to mcp-adapter.json.` The notice has one row for each moved server, for example `github -> plugin_acme_github_ (acme) [user]`. For the full notice, see [Plugin MCP servers moved out of mcp.json](output-catalog.md#plugin-mcp-servers-moved-out-of-mcpjson-amig-01-amig-03).

On that first start, pi-mcp-adapter can also warn that `mcp.json` holds an ignored `_piClaudeMarketplace` setting. The adapter read the old entries before the move. The warning does no harm.

A moved server keeps its declared name in `/claude:plugin info`, for example `plugin:acme:github`. Its key becomes `plugin_<plugin>_<server>_`, and its tools become `mcp__plugin_<plugin>_<server>__<tool>`. See [Server and tool names](#server-and-tool-names).

### What the new names cost

pi-mcp-adapter and pi-subagents keep some data under the old server names. The move does not carry that data to the new names:

- Sign in again to each server that uses OAuth. pi-mcp-adapter keeps each sign-in under the server name.
- Approve each project-scope server again. pi-mcp-adapter keeps each approval under the server name. See [Project-scope servers](#project-scope-servers).
- Run `/reload` one more time. pi-mcp-adapter reads its configuration when the session starts, before the move. Until the next `/reload`, it still shows the old names, and `/claude:plugin info` shows `not loaded` for each moved server. The live canary needed exactly one more `/reload`.
- Edit the pi-subagents `mcp:` overrides and the agent files that name an old server or tool. Edit them by hand, because the move does not rewrite them. `mcp:<old-name>` becomes `mcp:plugin_<plugin>_<server>_`. A tool that pi-mcp-adapter named `<old-name>_<tool>` with its default prefix becomes `mcp__plugin_<plugin>_<server>__<tool>`.
- Make your own changes again under the new name. The move writes each server as a fresh install writes it, so it does not carry an edit that you made to an old `mcp.json` entry (AMIG-01). For example, run `/mcp-adapter disable` again for a server that you turned off. The move removes the old-name settings that pi-mcp-adapter wrote for such a change. See [Old MCP server settings removed](output-catalog.md#old-mcp-server-settings-removed-amig-01).

### Entries that stay in mcp.json

Some entries cannot move. They stay in `mcp.json` and keep working under their old names. The notice lists them on every `/reload` until you remove the cause (AMIG-01, AMIG-04):

| Cause                                                                                                                             | What to do                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| No installed plugin in the scope owns the entry.                                                                                  | Install the plugin, or remove the entry from `mcp.json`.                                                                                  |
| The plugin comes from a git source, and its clone is not available offline.                                                       | Run `/claude:plugin reinstall <plugin>@<marketplace>`. A reinstall also clones the recorded commit when the cached mirror cannot be read. |
| The plugin comes from a git source, and its cached source has no plugin at the path the marketplace declares.                     | Run `/claude:plugin update <plugin>@<marketplace>`.                                                                                       |
| Another MCP configuration already defines the new key. No server of that plugin moves.                                            | Remove or rename that server, then run `/reload`.                                                                                         |
| The `mcp.json` file of the scope is not a valid MCP configuration.                                                                | Fix the file, then run `/reload`. No server of that scope moves.                                                                          |
| The `mcp-adapter.json` file of the scope is not a valid MCP configuration.                                                        | Fix the file, then run `/reload`. No server of that scope moves.                                                                          |
| The marketplace copy cannot give the plugin source, declares a path outside the plugin repository, or no longer lists the plugin. | Run `/claude:plugin marketplace update <marketplace>`, or uninstall the plugin to remove its old entries.                                 |
| The marketplace checkout itself is missing.                                                                                       | Remove the marketplace and add it again, or uninstall the plugin.                                                                         |
| Another Pi process holds the lock on `state.json`.                                                                                | Run `/reload` again later.                                                                                                                |
| The move wrote the new entries, but it could not update `mcp.json`.                                                               | Run `/reload` again. The next reload finishes the move.                                                                                   |

For the exact rows, see [Plugin MCP servers left in mcp.json](output-catalog.md#plugin-mcp-servers-left-in-mcpjson-amig-01-amig-04) and [Plugin MCP server move stopped](output-catalog.md#plugin-mcp-server-move-stopped-amig-03).

### Entries that the move removes

The move removes an old entry and writes no new one in these cases:

- The plugin no longer declares the server.
- The server needs a feature that pi-mcp-adapter cannot run. The other servers of the plugin move, and the plugin becomes `(partially-installed)`. See [Partially available plugins](#partially-available-plugins).
- The MCP configuration of the plugin is not valid. The move removes every server of that plugin, as a fresh install installs none of them.
- The plugin is disabled.

The notice lists each removed entry with its reason. See [Plugin MCP servers removed from mcp.json](output-catalog.md#plugin-mcp-servers-removed-from-mcpjson-amig-01-amig-03).

## Server status in info

On an installed plugin, `/claude:plugin info` shows the state of each server that this extension wrote. The state is the one that pi-mcp-adapter last reported on its status channel, the `pi-mcp-adapter/status/v1` event. Info does not connect a server to get it (ASTAT-01). The state comes first inside the parentheses after the server name, for example `plugin:deploy-tools:deploys (pending approval)`.

| Shown text                      | Meaning                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connected`                     | The server is connected.                                                                                                                                                                                                                                                                                      |
| `cached, connects on first use` | pi-mcp-adapter holds a cached list of the tools of the server. It starts the server when the model first uses one of them. This is the normal state of a lazy server, not a failure.                                                                                                                          |
| `needs authentication`          | The server needs a sign-in.                                                                                                                                                                                                                                                                                   |
| `pending approval`              | pi-mcp-adapter blocks this project server. The project is not trusted, the server needs approval, or you denied the approval. The panel of pi-mcp-adapter shows which. See [Project-scope servers](#project-scope-servers).                                                                                   |
| `disabled`                      | The server is turned off in the pi-mcp-adapter configuration, for example with `/mcp-adapter disable`.                                                                                                                                                                                                        |
| `not connected`                 | The server is not connected yet. This is also a normal state of a lazy server, not a failure.                                                                                                                                                                                                                 |
| `failed`                        | The server failed, and pi-mcp-adapter holds it in its failure backoff. The state shows only during the backoff.                                                                                                                                                                                               |
| `status unknown`                | pi-mcp-adapter is absent, sent no report in this session, last sent its empty report of a session start or a shutdown, or sent a report that this release cannot read.                                                                                                                                        |
| `not loaded`                    | The last report of pi-mcp-adapter does not list the server. The plugin was installed in this session, or the move from `mcp.json` wrote the server in this session. Run `/reload`. An old `mcp.json` entry that the move left in place also shows this state, because the adapter runs it under its old name. |
| `overridden by project scope`   | The plugin is installed in both scopes, and pi-mcp-adapter runs the project-scope entry in place of this user-scope entry.                                                                                                                                                                                    |

In some sessions, pi-mcp-adapter sends no report until the first MCP use. This happens when every server is lazy, no server comes from a project file, and the adapter holds a valid cached list of tools for each server. The adapter then sends only its empty report at the session start. So `status unknown` is the normal reading in such a session until the first tool call, `/mcp` or `/mcp-adapter` (ASTAT-02).

No state shows on a `(disabled)` row, on a row that is not installed, for a server that a partial install left out, or on a `components: not resolved` row. The state never changes the severity of the notice.

For the exact output, see [Partially installed -- each MCP server's state](output-catalog.md#partially-installed----each-mcp-servers-state-astat-01), [Installed -- an MCP server waits for project approval](output-catalog.md#installed----an-mcp-server-waits-for-project-approval-astat-01), and [Installed -- the adapter has not loaded an MCP server](output-catalog.md#installed----the-adapter-has-not-loaded-an-mcp-server-astat-02).

## Divergences and documented absences

The behaviors below differ from Claude Code. Each item names its reason: a recorded project decision or a Pi capability gap.

### Naming

- Keys that differ only by `-` versus `_` are refused. Reason: a Pi capability gap. Pi and pi-mcp-adapter group the tools of both servers under one name.
- pi-mcp-adapter shows the server key with a `_` at the end, for example `plugin_foo_api_`, and Claude Code shows `plugin:foo:api`. Reason: a Pi capability gap. The `_` makes pi-mcp-adapter build the tool names that Claude Code uses.
- Some tool names differ. Claude Code replaces every character outside `A-Z`, `a-z`, `0-9`, `_` and `-` in a tool name, and pi-mcp-adapter replaces only `.`. A tool name with another such character, such as a space, reaches the model with that character, and a provider can refuse it. Reason: a Pi capability gap. This extension does not control the tool names that a server reports.

### Loading

- Servers start lazily. pi-mcp-adapter stops a server when it is not in use, and Claude Code keeps it connected for the session. Reason: a project decision (ANAME-05). This extension leaves `lifecycle` to you, so you can change it for each server.
- Pi's `tool_search` is off by default. The model finds plugin tools through the `mcp` tool of pi-mcp-adapter. Reason: a Pi capability gap. Pi turns `tool_search` on only from your settings, and this extension does not write outside its own files.
- Hooks do not see calls through the `mcp` tool. Reason: a Pi capability gap. Pi reports the name of the `mcp` tool, not the name of the MCP tool that it calls.
- A malformed server makes the whole plugin unavailable. Claude Code skips only that server. Reason: a project decision (ANAME-07). A malformed component makes a plugin unavailable everywhere in this extension.
- The timeouts differ. The timeout of pi-mcp-adapter starts again on progress, and its default is 60 seconds instead of about 28 hours. Reason: a Pi capability gap. This extension writes only the values that the plugin declares (ANAME-07), so it writes no default.
- Project-scope plugin servers wait for the approval of pi-mcp-adapter. Claude Code never asks for approval of a plugin server. Reason: a project decision (NFR-10). pi-mcp-adapter owns project trust, and this extension never writes its approval files. See [Project-scope servers](#project-scope-servers).
- A tool that its server reports with `_meta["anthropic/alwaysLoad"]: true` still loads on demand. Claude Code keeps such a tool in the prompt. Reason: a Pi capability gap. pi-mcp-adapter ignores the `_meta` of a tool, and this extension writes the entry before the tool list is known.
- A server with tool permission rules installs and runs without them, with the warning `MCP server tool rules not enforced.` The schema of Claude Code accepts these rules for a remote server. Reason: a project decision (ANAME-07). pi-mcp-adapter has no rule for each tool, so the warning tells you that the rules do not apply. See [Tool permission rules](#tool-permission-rules).
- Some pi-mcp-adapter settings change or drop plugin servers, and this extension gives no warning about them. Reason: a project decision (ADOC-01). These settings are your own pi-mcp-adapter configuration. See [pi-mcp-adapter settings that change plugin servers](#pi-mcp-adapter-settings-that-change-plugin-servers).

### User choices

- Claude Code keeps the `/mcp` choice for a plugin server per project, in `~/.claude.json`, keyed by `plugin:<plugin>:<server>`. This extension keeps your choices for a server per scope file, in the `mcp-adapter.json` of the install scope, keyed by the server key and the plugin name. So a value that you write into a user-scope entry applies in every project. Reason: a Pi capability gap (D-08-02). pi-mcp-adapter has no per-project store for the fields of a user-scope entry. The one exception is the `disabled` choice, which `/mcp-adapter disable` writes into the project file. See [User overrides](#user-overrides).

### Variables

- Bash and every MCP server inherit `CLAUDE_PROJECT_DIR` from the process of Pi. Claude Code does not set it for Bash. Reason: a project decision (AVAR-01). This is how a user-scope server gets the current project.
- The `MCP server credentials withheld.` warning shows to the user. Claude Code writes the same fact only to its debug log. Reason: a project decision (AVAR-04). A user learns each time that a credential was withheld from a remote server.
- The deny-lists of Claude Code that depend on its mode are not used. These are the lists for a provider that a host manages, for a bridge child process, for the HIPAA tier, and for the scrub of subprocess variables. Reason: a project decision (AVAR-05). These lists depend on the state of a Claude Code process, and Pi does not run in these modes.
- A provider base URL that holds no credential at install time is written as `${NAME}`. If its value holds a credential later, pi-mcp-adapter sends that credential to the server. Claude Code checks the value each time it loads the server. Reason: a project decision (AVAR-05). This extension writes no environment value, so it checks the value only at install time.
- A kept `${NAME}` that is not set when pi-mcp-adapter starts the server becomes an empty value. pi-mcp-adapter refuses a `url` that holds such a reference. Claude Code keeps the literal `${NAME}` and shows a warning. Reason: a Pi capability gap. pi-mcp-adapter replaces every variable that is not set with an empty string.
- If the value of a variable at run time holds `$env:NAME` or `{env:NAME}`, pi-mcp-adapter expands that text again. The same applies if the values of two references join into such text, such as `${A}:${B}` when the value of `A` ends in `$env`. Reason: a Pi capability gap. pi-mcp-adapter has no literal mode that a configuration file can turn on. The values come from your own environment.
- In `command` and `args`, a leading reference that becomes empty before a literal `~` makes the value a path in your home directory, and Claude Code keeps the `~`. Three forms do this: an empty default with the variable not set at install, such as `${X:-}~/a`; a variable that is not set when pi-mcp-adapter starts the server, such as `${MISSING}~/a`; and a withheld credential that is set at install, such as `${OTEL_X}~/a`, which the install writes as an empty value. A value at run time that starts with `~/` does the same. Reason: a Pi capability gap. pi-mcp-adapter replaces a leading `~` after it expands variables. The install check for a leading `~` reads only the text of the plugin, so it cannot know which reference becomes empty.
- pi-mcp-adapter can load before this extension. If a user override then makes a user-scope server `eager` or `keep-alive`, a `url` with a split token can fail one time, before this extension sets `PI_CLAUDE_MARKETPLACE_EMPTY`. This includes a common `url` such as `https://${HOST}:8080/mcp`, which gets a split token after the reference. The session start of pi-mcp-adapter connects the server again in the same session. Reason: a Pi capability gap. An extension cannot set the order in which Pi loads extensions.
- An entry can change between two installs if the environment at install time changes. For example, `${NAME:-default}` is written as the default while `NAME` is not set and as `${NAME}` after you set it. pi-mcp-adapter then sees a new server definition, so it can ask you again to approve a project server. Reason: a project decision (AVAR-02). The install writes no environment value.
- This extension does not set `literalEnv` on an entry. `literalEnv: true` turns off the expansion of `${NAME}` in `env` when pi-mcp-adapter starts the server, and the rule of Claude Code needs that expansion. Reason: a project decision (AVAR-03).
- A remote server whose headers hold no `Authorization` key keeps OAuth in Claude Code, whatever its header values are. In OAuth mode, pi-mcp-adapter refuses a header that references a variable that is not set, a header that is empty, such as a withheld credential, and a header that holds the split token. So this extension writes no `auth: "oauth"` for such a server, and the server keeps connecting without OAuth. Claude Code keeps the text of the header, shows a warning, and keeps OAuth. Also, if a header of a server with `auth: "oauth"` references a variable that is set at install but not when pi-mcp-adapter starts the server, the adapter refuses the header, and the server does not connect. Reason: a Pi capability gap (D-08-04). pi-mcp-adapter has no OAuth mode that accepts such headers. See [OAuth beside headers](#oauth-beside-headers).

### Migration

- The renamed servers appear only after one more `/reload`. In Claude Code, a plugin server keeps one name, so nothing moves. Reason: a Pi capability gap. pi-mcp-adapter reads its configuration when the session starts, before this extension moves the entries. See [Upgrading](#upgrading).
- The move removes every server of a plugin whose MCP configuration is not valid. Claude Code skips only the malformed server and loads the others. Reason: a project decision (AMIG-01). A fresh install of that plugin installs no MCP server either.
- The move carries nothing from an old `mcp.json` entry, so an edit that you made to that entry does not survive. Reason: a project decision (AMIG-01). The old entries are cleanup, not input: the move writes each server as a fresh install writes it.

### Status

- `/claude:plugin info` shows `failed` for a server in the failure backoff of pi-mcp-adapter. The status text of Claude Code says `not connected` for a failed server. Reason: a project decision (ASTAT-01). pi-mcp-adapter keeps a failure apart from a server that it never discovered, and `failed` is the word of the `/mcp` panel of Claude Code. See [Server status in info](#server-status-in-info).

## Further reading

- [Claude Code MCP reference](https://code.claude.com/docs/en/mcp) -- the upstream reference for plugin MCP servers, tool names, timeouts, OAuth, and tool search.
- [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter) -- the Pi package that runs the servers, with its own configuration reference.
- [pi-mcp-adapter configuration](https://github.com/nicobailon/pi-mcp-adapter/blob/main/docs/configuration.md) -- the file layout, the order in which pi-mcp-adapter reads its files, and the trust rules for project servers.
- [MCP adapter canary](../tests/live-uat/README.md#mcp-adapter-canary----mcp-adapter-canarymjs) -- the live test that runs this extension with pi-mcp-adapter 5.2.0, and its recorded result.
- [Hook compatibility](hooks-compatibility.md) -- how plugin hooks match MCP tools.
- [Environment variables](env-vars.md) -- the variables that this extension adds to the `env` of stdio servers.
- [Output catalog](output-catalog.md) -- the exact text of the `{unsupported mcp}` and `{malformed mcp}` rows, the `info` output, and the override notice.
- [README: Name mapping](../README.md#name-mapping) -- the names of commands, skills, and MCP servers.
