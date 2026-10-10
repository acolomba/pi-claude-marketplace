# Upstream parity research: MCPOVR-01, MCPROW-01, WR-02

Retrieved 2026-10-09. Binary: Claude Code 2.1.296
(`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.296/claude`, from
`readlink -f $(which claude)`). Docs: https://code.claude.com/docs/en/mcp.
Adapter: pi-mcp-adapter 5.2.0 at `/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter/dist`.
No probe was run. All answers come from docs and binary/dist reads.

---

## 1. MCPOVR-01: do per-server choices survive `/plugin disable` then `/plugin enable`?

**Claude Code behavior: yes.** The `/mcp` on/off choice is not stored with the
plugin. It is stored per project in `~/.claude.json` under
`projects[<projectPath>].disabledMcpServers`, keyed by the server's full name
`plugin:<plugin>:<server>`. Plugin disable, enable and uninstall do not touch
that list. Re-enabling the plugin registers the same name again, and the
recorded "off" still applies.

Evidence:

- Docs (mcp page): "When you toggle a server, Claude Code records your choice per
  project in `~/.claude.json`, in one of two lists ... `disabledMcpServers`: an
  opt-out list for user-configured servers, plugin servers, ..." Also: "The
  server itself registers under the scoped name `plugin:<plugin-name>:<server-name>`".
- Binary, the read and the only writer:
  `function To(e){let n=Xi();if(pge(e))return!hge(n.enabledMcpServers).includes(e);return hge(n.disabledMcpServers).includes(e)}`
  and `Y2e(e,n,r)`, which rewrites `disabledMcpServers` through `Lm(...)`.
  `Xi()` returns `ce().projects[pFe()]`, which is the project entry of `~/.claude.json`.
- Binary, plugin server key: `function e3r(e,n,r,s){...let H=\`plugin:${y}:${S}\`...}` with `y=ZM(n,r)`.
  ZM returns the plugin name. Built-in plugins can use an alias.
- Binary: `disabledMcpServers` appears exactly 6 times. All of them are in the
  read (`To`), the toggle (`Y2e`), the change watcher (`ye()`), and one
  guidance string. No plugin lifecycle code refers to it.
- Binary, uninstall cleanup (`Qt`/`Xt`): it removes install records, the
  version folder, the data dir, and plugin options (userConfig). It does not
  clear MCP toggles.
- Binary, guidance string: "`/mcp disable <server>` (persists to
  `"disabledMcpServers"` in the project entry of `~/.claude.json` -- reversible with
  `/mcp enable`) ... The `/mcp disable` toggle is per-project: even for a
  user-scope server it applies to the current project only".
- Binary, per-plugin-server status check, the order is: config error, project
  approval, `if(To(s))return _e("disabled",\`The MCP server "${s}" is turned off; turn it on in /mcp.\`)`.
  The toggle is checked by name at connect time, separately from plugin state.

Tool approvals: upstream has no per-server approval list for plugin servers.
"Always allow" becomes a permission rule (`mcp__plugin_<plugin>_<server>__<tool>`)
in a settings file (`permissions.allow`). The rules are keyed by tool name, so
they also survive plugin disable and enable. I found no plugin lifecycle code
that removes them, but I did not prove that none exists. Confidence: medium.
(Project-scope plugins from the inline/directory marketplace also go through
the `.mcp.json` approval gate (`JW(e)?ane(s)`). That gate does not apply here.)

Confidence: **high** for `disabledMcpServers` (docs plus binary). **Medium** for
permission rules.

Constraints and divergence notes:

- Upstream stores choices outside the plugin, by name, and per project. Pi
  stores user choices inside the marked `mcp-adapter.json` entry, which disable
  removes. A Claude-parity design keeps the carried fields outside the
  unstageable entry (for example in the install record or the marker's
  `keptOverride`), keyed by server name, and re-applies them on enable.
- Upstream keeps them through **uninstall** too. If Pi drops them on uninstall,
  that is a further divergence and needs its own recorded decision.
- Upstream scope is per project, not per plugin install scope. pi-mcp-adapter
  has no per-project toggle list. That is a Pi capability gap, if it matters.
- Open question: whether Pi's other carried fields (`lifecycle`, etc.) have
  any upstream equivalent. I found none. Only on/off and permission rules
  exist upstream.

---

## 2. MCPROW-01: how upstream reports enable/install of a plugin whose MCP config has missing env vars

**Claude Code behavior:** enable and install report plain success. No MCP
warning, no "needs attention" line, and the enable/install severity does not
change. The missing variable shows up later, when MCP servers are gathered or
connected: as a warning in `/mcp` and `claude mcp list`, as a plugin error
entry, and in the debug log. The server still loads with the `${VAR}` text
unexpanded.

Evidence:

- Binary, CLI enable result:
  `message:\`Successfully ${p}d plugin: ${de} (scope: ${y})${Pe}${ee}\`` (plus a
  dependency and reverse-dependent note). The enable op has no MCP or env handling.
- Binary, `/plugin` UI install/enable follow-up text (`$a`/`Km`): the status is
  `activated` | `needs-config` | `load-failed` | `reload-required`, and the
  messages are " Plugin is now active.", or with `needs-config` " Plugin is now
  active." plus "Its bundled MCP server needs configuration before it can start
  -- select the plugin in /plugin's Installed tab and choose Configure.", or
  " The plugin couldn't be loaded -- see /plugin for details.", or
  " Run /reload-plugins to apply.". `needs-config` is raised only by the
  `mcpb-needs-config` warning (MCPB user_config). `load-failed` is raised by
  plugin load errors from `refreshActivePlugins` (`eL`).
- Binary: `eL` loads plugin MCP servers through `ret`/`net`. Those read the raw
  config and do **not** expand variables, so a missing env var cannot produce
  `load-failed` or `needs-config` at install or enable time.
- Binary, expansion at MCP config time (`AUo`, called from `HSt` in the MCP
  config gathering):
  `if(s&&S.length>0){let be=D(S).join(", ");if(t(\`Missing environment variables in plugin MCP config: ${be}\`,{level:"warn"}),h&&y)s.push({type:"mcp-config-invalid",source:n.source,plugin:h,serverName:y,validationError:\`Missing environment variables: ${be}\`})}`
  The server is returned anyway. It gets `configError` only when the expanded
  `url` is not a valid URL (`env_missing` / `url_empty` / `url_invalid` /
  `user_config_missing`). In that case the per-server status is "failed".
- Binary, how the error renders in plugin error lists:
  `Invalid MCP server config for "<server>": Missing environment variables: X`,
  with the hint "Check MCP server configuration in .mcp.json or manifest".
  The MCP gatherer also logs it as `Plugin MCP server error - mcp-config-invalid: ...` at error level.
- Docs (mcp page): "**Missing environment variable**: if a `${VAR}` reference
  in a server's configuration names a variable that isn't set and has no
  `:-default`, Claude Code warns in `claude mcp list` output and in `/mcp`,
  naming the variable, and still loads the server with the `${VAR}` text
  unexpanded." Also: "If a referenced environment variable isn't set ..., the
  config still loads: Claude Code reports a missing-variable warning".
- Docs: credential variables (`ANTHROPIC_API_KEY`, `AWS_BEARER_TOKEN_BEDROCK`,
  `NPM_TOKEN`, ...) in a remote server's `url`/`headers` "read as empty
  ... with no warning". This is the upstream counterpart of withheld
  credentials, and it is silent.

Upstream does treat a missing env var as a **warning**, but it reports it on
the MCP surfaces (`/mcp`, `claude mcp list`, plugin errors), not on the
enable/install line. The enable/install line is unchanged.

Confidence: **high** for the enable/install text and for when expansion runs.
**Medium** for exactly which plugin-errors view shows the `mcp-config-invalid`
entry. The gatherer's `errors` array is returned to callers, and I did not
trace every consumer.

Constraints and divergence notes:

- Pi has no `/mcp` or `mcp list` surface owned by this extension, so the
  install-time notice is the only place the user hears about it. Showing a
  notice is a Pi capability gap. Changing the plugin row's state
  (`(installed)` instead of enabled) has no upstream analogue: upstream
  reports the enable as done.
- An upstream-faithful rendering keeps the enable/import row as its normal
  success row and carries the MCP notice as a separate warning line. Whether
  that line raises the overall severity to warning is a project severity-model
  decision. Upstream does not raise severity on the enable line itself. Its
  only "needs attention" analogue is the MCPB `needs-config` suffix, and that
  is still phrased as "Plugin is now active."
- Import: upstream has no bulk import verb. The closest analogue is the
  multi-install summary `✓ Installed N plugins. Plugins are now active.`, which
  has no MCP notices either.

---

## 3. WR-02: `headers` plus `oauth` on a remote server

**Claude Code behavior:** OAuth stays active **unless the static headers
contain an `Authorization` key** (case-insensitive), or a `headersHelper`
supplies Authorization. Other headers do not disable OAuth. The `oauth` object
is not what turns OAuth on. Every http/sse server without a user Authorization
header gets the OAuth provider, and `oauth` only supplies clientId,
callbackPort and similar values.

Evidence (binary 2.1.296):

- `function aH(e){return PZt(e.headers??{})}` and
  `function PZt(e){return Object.keys(e).some((n)=>n.toLowerCase()==="authorization")}`
- In connect: `ae=(r.type==="sse"||r.type==="http")&&aH(r)` and
  `let E=ae||me||ie||se?void 0:new MBt(e,r)` (the OAuth provider), then
  `{authProvider:E,fetch:H,requestInit:{...,headers:{...,...B}}}`. `me` is
  helper-minted Authorization, `ie` is first-party auto-auth, `se` is a
  CLI-owned bearer.
- On rejection with a user Authorization header: errorCode `AUTH_HEADER_REJECTED`,
  "Server rejected the configured Authorization header ... OAuth fallback is
  disabled when headers.Authorization is set."
- Docs: "If you configured `headers.Authorization` for the server and the
  server rejects that header, Claude Code reports the connection as failed
  instead of falling back to OAuth." And for headersHelper: "When the helper's
  output includes an `Authorization` header, Claude Code uses that credential
  ... and doesn't fall back to OAuth for the server."

Confidence: **high**.

pi-mcp-adapter 5.2.0 (`dist/mcp-auth-flow.js:1054`):

```js
export function supportsOAuth(definition) {
    if (!definition.url) return false;
    if (definition.auth === false) return false;
    if (definition.oauth === false) return false;
    if (definition.auth === "oauth") return true;
    // Configured custom headers take precedence over implicit OAuth auto-detection.
    if (definition.headers && Object.keys(definition.headers).length > 0) return false;
    return definition.auth === undefined;
}
```

- Writing `auth: "oauth"` keeps OAuth active alongside `headers`: **confirmed**.
  `connectHttpClient` (`server-manager.js:1308-1395`) computes
  `oauthEnabled = supportsOAuth(definition)`, resolves headers through
  `resolveOAuthHeaders`, and builds an explicit auth provider
  (`{ status: "explicit", provider: createAuthProvider() }`). It sends the
  headers as same-origin "service headers" through `createOAuthFetch`
  (`mcp-auth-fetch.js:42`). Per-request SDK headers, including the OAuth
  bearer, override them.
- With `auth` unset and any non-empty `headers`, the adapter disables OAuth.
  Claude Code does not. So the gap covers **every** remote server with
  non-Authorization headers, not only the ones with an `oauth` object.
- Adapter differences that matter for the mapping rule:
  - With `headers.Authorization` plus `auth: "oauth"`, the adapter would still
    run OAuth and replace the static header after sign-in. Upstream disables
    OAuth there. The parity mapping is therefore: write `auth: "oauth"` for
    a remote server whose `headers` are non-empty and contain no
    `Authorization` key (case-insensitive), whether or not `oauth` is present.
    Leave `auth` unset when `headers` include Authorization. The adapter's
    implicit rule (`headers` non-empty gives no OAuth) then matches upstream.
    With no `headers`, `auth` unset already gives implicit OAuth in the adapter.
  - In OAuth mode, the adapter's `resolveOAuthHeaders` throws ("Missing
    environment credential in OAuth HTTP headers" / "Failed to resolve OAuth
    HTTP headers") on an unset `${VAR}` or an empty resolved value.
    Upstream keeps the unexpanded text and warns. This matters only if the
    extension leaves `${VAR}` in the written headers. Check `substitute.ts`.
  - The review text for WR-02 (`03-REVIEW.md`) says "Claude keeps OAuth in
    both cases". That holds only when `headers` has no Authorization key.

---

## Open items

- MCPOVR-01: decide whether Pi keeps the carried fields through uninstall
  (upstream does) and whether a per-project toggle is needed (Pi gap).
- MCPROW-01: upstream gives no rule for the import grammar. The severity of a
  separate MCP notice line is a project decision.
- WR-02: confirm the Authorization-header exclusion with the operator before
  widening the fix from "oauth present" to "non-Authorization headers present".
