# MCP compatibility

This document compares how Claude Code and this extension run the MCP servers of a Claude plugin. It covers names, tool search, the length of tool names, the connection lifecycle, the translation of each server field, and the places where the two products differ.

Legend: `✓` supported, `✗` not supported, `⚠` partial (see notes), `--` no equivalent on that side.

The Claude Code column reflects the MCP reference at [code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp) and the server schemas in the Claude Code 2.1.291 binary. The Pi column reflects pi-mcp-adapter 5.0.0 on Pi 1.0.0 and the sources under `extensions/pi-claude-marketplace/bridges/mcp/` and `extensions/pi-claude-marketplace/domain/`. Statements about run-time behavior come from a measurement on 2026-10-06. That measurement ran a real Pi 1.0.0 with pi-mcp-adapter 5.0.0 in a sandbox, with a local test MCP server and a stub model provider that logged each request.

This extension does not run MCP servers itself. It writes one entry for each plugin server into the `mcp-adapter.json` file of the install scope: `~/.pi/agent/mcp-adapter.json` for the user scope, `<project>/.pi/mcp-adapter.json` for the project scope. pi-mcp-adapter reads that file and runs the servers.

## Server and tool names

Claude Code registers a plugin server under the name `plugin:<plugin>:<server>`. The model sees each tool of that server as `mcp__plugin_<plugin>_<server>__<tool>`. To make a name, Claude Code replaces every character outside `A-Z`, `a-z`, `0-9`, `_` and `-` with `_` (ANAME-01).

This extension gives the tools the same names. It applies the same rule to `plugin:<plugin>:<server>` and adds a `_` at the end. The result is the key of the server entry in `mcp-adapter.json`. Every entry also gets `toolPrefix: "mcp"`. With this key and this prefix, pi-mcp-adapter names each tool `mcp__plugin_<plugin>_<server>__<tool>`, the name that Claude Code uses. The `_` at the end of the key gives the `__` between the server name and the tool name.

| Plugin | `mcpServers` key | Key in `mcp-adapter.json` | Tool names                      | Name shown by `info` |
| ------ | ---------------- | ------------------------- | ------------------------------- | -------------------- |
| `foo`  | `api`            | `plugin_foo_api_`         | `mcp__plugin_foo_api__<tool>`   | `plugin:foo:api`     |
| `foo`  | `my.db`          | `plugin_foo_my_db_`       | `mcp__plugin_foo_my_db__<tool>` | `plugin:foo:my.db`   |
| `bar`  | `api`            | `plugin_bar_api_`         | `mcp__plugin_bar_api__<tool>`   | `plugin:bar:api`     |

`/claude:plugin info` shows each server by its Claude Code name, `plugin:<plugin>:<server>`, with the server name exactly as the plugin declares it. The pi-mcp-adapter panel and commands, such as `/mcp-adapter disable`, show and accept the key, with its `_` at the end. pi-subagents `mcp:` entries also use the key.

Two plugins can declare servers with the same name. Their keys differ, because each key holds the plugin name.

An install, update, or reinstall fails before it writes anything if the new key is equal to the key of another server. The other server can belong to the same plugin, to another plugin, or to any MCP configuration that pi-mcp-adapter reads. Pi groups the tools of a server under a name in which every `-` of the key becomes `_`. So the install also fails if the two keys are equal after every `-` becomes `_`, for example `plugin_foo_my-db_` and `plugin_foo_my_db_`. Claude Code runs these two servers side by side. This refusal applies only to Pi (ANAME-03). See [Divergences and documented absences](#divergences-and-documented-absences).

## Tool search

| Feature                                   | Claude Code | Pi  | Notes                                                                             |
| ----------------------------------------- | ----------- | --- | --------------------------------------------------------------------------------- |
| Tools load on demand through a search     | ✓           | ✓   | Pi: through the `mcp` tool of pi-mcp-adapter                                      |
| `alwaysLoad: true` keeps tools in context | ✓           | ✓   | written as `directTools: true`                                                    |
| Pi's own `tool_search` tool               | --          | ⚠   | off by default. Turn it on with `"defaultTools": ["+tool_search"]` in Pi settings |

Claude Code keeps MCP tools out of the prompt by default and finds them through its tool search. A server with `alwaysLoad: true` keeps all its tools in the prompt.

This extension writes `directTools: "search"` on every entry, so pi-mcp-adapter keeps the tools out of the first request to the model. A server with `alwaysLoad: true` gets `directTools: true`, so its tools are in every request (ANAME-04).

The model finds a tool through the `mcp` tool of pi-mcp-adapter. A call such as `mcp({ search: "query a database" })` searches the tools of all servers and activates each tool that matches. From the next request on, the model sees each activated tool by its full name, such as `mcp__plugin_foo_api__query`, and calls it directly.

Pi also has its own `tool_search` tool. It is off by default, and pi-mcp-adapter does not turn it on. If you want the model to use it, add this setting to your Pi settings file, `~/.pi/agent/settings.json` or `<project>/.pi/settings.json`:

```json
{
  "defaultTools": ["+tool_search"]
}
```

This extension never edits Pi settings files. The choice to add this setting is yours.

## Name length

Claude Code does not shorten MCP tool names and does not check their length when it installs a plugin. This extension does the same: no install-time length check exists (ANAME-03).

The measurement of 2026-10-06 showed that Pi and pi-mcp-adapter do not limit the length of these names either. Pi 1.0.0 with pi-mcp-adapter 5.0.0 registered tools with names of 64, 65, 80 and 136 characters. It sent all of them to the model provider, and it ran the 136-character tool when the model called it. Pi's built-in MCP support shortens names that are longer than 64 characters, but pi-mcp-adapter turns that built-in support off.

The limit is in the model provider:

- OpenAI accepts function names of at most 64 characters.
- Anthropic accepts tool names that match `^[a-zA-Z0-9_-]{1,128}$`, so at most 128 characters.

A long plugin name and a long server name can make a tool name that a provider refuses. The provider then rejects the request. The measurement did not send an over-long name to a real provider, so this document does not record the exact error. To find the length of a tool name, add the lengths of `mcp__plugin_`, the plugin name, `_`, the server name, `__`, and the tool name.

## Connection lifecycle

Claude Code connects to the MCP servers of plugins in the background when a session starts. It keeps the connections for the whole session.

This extension never writes `lifecycle` on an entry, so pi-mcp-adapter uses its default, `lazy` (ANAME-05). In this mode, the adapter starts each server when Pi starts, reads the list of its tools, and then stops it. The adapter starts the server again when the model uses one of its tools, and stops it again after a period with no use.

Thus the first call to a tool of a stopped server waits while the server starts. A server that keeps data in memory loses that data when the adapter stops it. You can change the mode of one server: set `lifecycle` on its entry yourself. This extension keeps that field when it updates or reinstalls the plugin.

## Translated fields

This extension builds each entry from a closed table. It writes only the fields below, and only when the plugin's value has the type that Claude Code accepts (ANAME-06, ANAME-07).

| Claude Code field             | Server types | pi-mcp-adapter field          | Rule                                                                                                                                                                      |
| ----------------------------- | ------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type` absent or `"stdio"`    | stdio        | --                            | Not written. pi-mcp-adapter starts a stdio server from `command`.                                                                                                         |
| `type: "http"`                | remote       | --                            | Not written, and `httpTransport` stays unset. pi-mcp-adapter uses its default HTTP transport. `"streamable-http"` is the same type.                                       |
| `type: "sse"`                 | remote       | `httpTransport: "sse"`        |                                                                                                                                                                           |
| `command`                     | stdio        | `command`                     | Copied.                                                                                                                                                                   |
| `args`                        | stdio        | `args`                        | Copied.                                                                                                                                                                   |
| `env`                         | stdio        | `env`                         | Copied. This extension adds the plugin variables. See [Environment variables](env-vars.md).                                                                               |
| `url`                         | remote       | `url`                         | Copied.                                                                                                                                                                   |
| `headers`                     | remote       | `headers`                     | Copied.                                                                                                                                                                   |
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

## Dropped fields

This extension drops every other field of a plugin server, with no warning, as Claude Code does. The dropped fields include:

- The Claude Code fields `cwd`, `role`, and `discoveryCache`.
- Every field that only pi-mcp-adapter knows, for example `auth`, `approveTools`, `requestHeadersCommand`, `inheritEnv`, `bearerTokenEnv`, and `lifecycle`.
- Every `oauth` field outside the four in the table, for example `clientSecret`.
- Every unknown field.

A plugin that declares `description`, `directTools`, or `toolPrefix` gets the value of this extension instead.

So a plugin cannot give itself a pi-mcp-adapter power that Claude Code does not give a plugin. For example, a plugin cannot send your Pi provider token to its server with `auth`, and it cannot approve its own tools with `approveTools`.

## Partially available plugins

Some MCP server features of Claude Code have no equivalent in pi-mcp-adapter.

| Feature                                                     | Claude Code | Pi  | Notes                                                                                                                       |
| ----------------------------------------------------------- | ----------- | --- | --------------------------------------------------------------------------------------------------------------------------- |
| `type: "ws"`                                                | ✓           | ✗   | pi-mcp-adapter has no WebSocket transport.                                                                                  |
| `type` `"sse-ide"`, `"ws-ide"`, `"sdk"`, `"claudeai-proxy"` | ⚠           | ✗   | Claude Code uses these types for connections of its own host, not for plugin servers. pi-mcp-adapter has no such transport. |
| `headersHelper`                                             | ✓           | ✗   | `requestHeadersCommand` of pi-mcp-adapter has a different contract.                                                         |
| `oauth.xaa` with a true value                               | ✓           | ✗   | pi-mcp-adapter has no cross-app access flow.                                                                                |
| `tools[].permission_policy`                                 | ✓           | ✗   | pi-mcp-adapter has no permission policy for each tool. Its `approveTools` field belongs to the user.                        |
| `toolPermissions` that is not empty                         | ✓           | ✗   | Same as `tools[].permission_policy`.                                                                                        |
| `bareElicitationCapability: true`                           | ✓           | ✗   | pi-mcp-adapter always announces form and URL elicitation, with no switch for one server.                                    |

If a server of a plugin uses one of these features, the plugin is `(partially-available)` with the reason `{unsupported mcp}`. A normal install refuses the plugin and suggests `--partial`. With `--partial`, the install writes every other component and every other server. It leaves out each affected server completely. The installed plugin then shows `(partially-installed)`. `/claude:plugin info` names each server that the install leaves out, with the feature that blocks it, for example `plugin:db-tools:live (unsupported ws)`. The agents of the plugin get no tools from a server that the install leaves out.

## Invalid server configs

A server config that the schema of Claude Code rejects is malformed. Examples are an unknown `type`, a `url` with no `type`, a `timeout` that is not a positive integer, and a `callbackPort` outside 1 to 65535. If a plugin has a malformed server, the whole plugin is `(unavailable)` with the reason `{malformed mcp}`, and no part of it installs. Claude Code skips only that server, shows an error, and loads the other servers of the plugin.

## User overrides

You can change a plugin server's entry in `mcp-adapter.json` yourself. For example, `/mcp-adapter disable` writes `disabled: true`. When this extension updates or reinstalls the plugin, it keeps your values of these fields: `disabled`, `approveTools`, `includeTools`, `excludeTools`, `lifecycle`, `idleTimeout`, `requestTimeoutMs`, `debug`, and `searchKeywords`.

One exception exists. If the plugin's own entry sets one of these fields, the plugin owns that field. Today this applies only to `requestTimeoutMs`, which comes from the server's `timeout`. An update or a reinstall then writes the plugin's value, not yours. This matches Claude Code, where a user cannot change the timeout of a plugin server.

You can also write an override before the install: an entry under the server's key with no `command` and no `url`. The install keeps that override inside the plugin's entry. If the plugin sets a field of the override, that field stops applying, and the install shows a warning that names the field. If a later version of the plugin stops setting the field, your value applies again. When you uninstall or disable the plugin, this extension writes your override back, with your own value of each field that the plugin set. For the exact notice and the full list of commands that write the override back, see [MCP server override kept](output-catalog.md#mcp-server-override-kept-afile-06).

## Hooks and agents

Plugin hooks see MCP tools by their Claude Code names (ANAME-02). The matcher `mcp__plugin_foo_api__query` fires for that tool, and `mcp__plugin_foo_api__.*` fires for every tool of the server. `if` predicates work the same way. See [Tool name mapping](hooks-compatibility.md#tool-name-mapping).

A call that the model makes through the `mcp` tool of pi-mcp-adapter, such as `mcp({ tool: "mcp__plugin_foo_api__query" })`, reaches hooks as tool `mcp`. The plugin's MCP matchers and `if` predicates do not fire for that call. A direct call to an activated tool fires them as usual.

A `tools:` entry of a plugin agent that names one of the plugin's own MCP tools becomes a pi-subagents `mcp:` entry. For example, `mcp__plugin_foo_api__query` becomes `mcp:plugin_foo_api_/query`. pi-subagents runs MCP tools only in background launches, so such an agent needs `async: true`. See [Customizing generated agents](../README.md#customizing-generated-agents).

pi-subagents compares the tool part of an `mcp:` entry with the tool name that the server reports. If that name holds a character that Claude Code replaces, such as `.` or a space, the Claude Code form of the name does not match. Then the agent cannot get the tool through its Claude Code name.

## Divergences and documented absences

The behaviors below differ from Claude Code. Each item names its reason: a recorded project decision or a Pi capability gap.

- Servers start lazily. pi-mcp-adapter stops a server when it is not in use, and Claude Code keeps it connected for the session. Reason: a project decision (ANAME-05). This extension leaves `lifecycle` to you, so you can change it for each server.
- Pi's `tool_search` is off by default. The model finds plugin tools through the `mcp` tool of pi-mcp-adapter. Reason: a Pi capability gap. Pi turns `tool_search` on only from your settings, and this extension does not write outside its own files.
- Hooks do not see calls through the `mcp` tool. Reason: a Pi capability gap. Pi reports the name of the `mcp` tool, not the name of the MCP tool that it calls.
- Keys that differ only by `-` versus `_` are refused. Reason: a Pi capability gap. Pi and pi-mcp-adapter group the tools of both servers under one name.
- A malformed server makes the whole plugin unavailable. Claude Code skips only that server. Reason: a project decision (ANAME-07). A malformed component makes a plugin unavailable everywhere in this extension.
- The timeouts differ. The timeout of pi-mcp-adapter starts again on progress, and its default is 60 seconds instead of about 28 hours. Reason: a Pi capability gap. This extension writes only the values that the plugin declares (ANAME-07), so it writes no default.
- pi-mcp-adapter shows the server key with a `_` at the end, for example `plugin_foo_api_`, and Claude Code shows `plugin:foo:api`. Reason: a Pi capability gap. The `_` makes pi-mcp-adapter build the tool names that Claude Code uses.
- Some tool names differ. Claude Code replaces every character outside `A-Z`, `a-z`, `0-9`, `_` and `-` in a tool name, and pi-mcp-adapter replaces only `.`. A tool name with another such character, such as a space, reaches the model with that character, and a provider can refuse it. Reason: a Pi capability gap. This extension does not control the tool names that a server reports.

## Further reading

- [Claude Code MCP reference](https://code.claude.com/docs/en/mcp) -- the upstream reference for plugin MCP servers, tool names, timeouts, OAuth, and tool search.
- [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter) -- the Pi package that runs the servers, with its own configuration reference.
- [Hook compatibility](hooks-compatibility.md) -- how plugin hooks match MCP tools.
- [Environment variables](env-vars.md) -- the variables that this extension adds to the `env` of stdio servers.
- [Output catalog](output-catalog.md) -- the exact text of the `{unsupported mcp}` and `{malformed mcp}` rows, the `info` output, and the override notice.
- [README: Name mapping](../README.md#name-mapping) -- the names of commands, skills, and MCP servers.
