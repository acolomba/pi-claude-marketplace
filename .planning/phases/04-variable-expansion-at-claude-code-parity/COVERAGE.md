# API Coverage — Claude Code plugin MCP variable expansion, through pi-mcp-adapter's second expansion

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

Surface: Claude Code 2.1.291's plugin MCP variable pipeline (`uLo`: the `Ase` builtins, `A_t` user config, the `oq` rule, the `U4` credential deny-list and its two warnings) as it reaches pi-mcp-adapter 5.1.0, whose connect-time functions (`interpolateEnvVars`, `resolveCommandSecret`, `resolveServerUrl`, `expandHomePath`, `extractOAuthConfig`) expand the written entry a second time. This phase calls no network API. Decisions come from 04-CONTEXT.md (D-04-01 to D-04-19).

| capability | decision | reason |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` expansion in Claude's five fields | INTEGRATE | |
| `${CLAUDE_PLUGIN_DATA}` expansion in Claude's five fields | INTEGRATE | |
| `${CLAUDE_PROJECT_DIR}` (project: at install; user: at runtime from Pi) | INTEGRATE | |
| plain `${VAR}` expansion at runtime | INTEGRATE | |
| `${VAR:-default}` resolved at install with Claude's rule | INTEGRATE | |
| five expansion fields: stdio command, args, env; remote url, headers | INTEGRATE | |
| `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` env values left unexpanded | INTEGRATE | |
| injected stdio env CLAUDE_PLUGIN_ROOT and CLAUDE_PLUGIN_DATA | INTEGRATE | |
| plain credential deny-list in all five fields | INTEGRATE | |
| remote-sink deny-list, name patterns and `*_BASE_URL` value rule | INTEGRATE | |
| missing-variable warning | INTEGRATE | |
| remote-sink credential warning | INTEGRATE | |
| `/plugin` errors list for unset and withheld variables (as `info` lines) | INTEGRATE | |
| adapter `$env:`, `{env:}` and `${1X}` syntax kept literal | INTEGRATE | |
| adapter leading `!` command execution in `env` and `headers` | INTEGRATE | |
| adapter home expansion of a leading `~` in `command` and `args` | INTEGRATE | |
| `${user_config.KEY}` substitution | OPT-OUT | explicitly out of scope: `userConfig` is an unsupported component, and its text stays literal through both expanders |
| `headersHelper` expansion | OPT-OUT | explicitly out of scope: a `headersHelper` server is a partial install and is never written (D-03-10) |
| mode-gated deny sets `Gqe`, `Voo`, `Gur` and `tRe` | OPT-OUT | explicitly out of scope: Claude-only runtime state (host-managed provider, bridge child, HIPAA tier, subprocess scrub), D-04-14 |
| wildcard-variable detection (`wildcardVars`) | OPT-OUT | not needed: Claude Code does not act on it for plugin MCP servers |
| adapter `literalEnv` mode | OPT-OUT | not needed: it turns off the runtime `${VAR}` expansion Claude's rule needs (ENVLIT-01) |
| expansion for `ws` and host-only server types | OPT-OUT | not needed: such servers are partial installs and are never written (D-03-10, D-03-20) |
