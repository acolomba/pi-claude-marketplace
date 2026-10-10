# Environment variables

How the Claude plugin environment variables Claude Code exposes are delivered to plugin components once a plugin is installed under Pi. The table register mirrors [`docs/hooks-compatibility.md`](hooks-compatibility.md): a **Claude Code** ground-truth column against Pi's delivery. Claims here are transcribed from the shipped bridge sources, not from upstream docs. For the content and hook rows, the Claude Code ground truth was verified against the Claude Code v2.1.212 binary and a live session env (DOC-06). The MCP rows follow Claude Code 2.1.291 and pi-mcp-adapter 5.2.0, as [MCP compatibility](mcp-compatibility.md#variables) describes them.

## Delivery mechanisms

Pi delivers these variables through three mechanisms. The overview matrix marks every cell with which one applies.

- **S -- install-time textual substitution.** Install-stable, per-plugin values are baked into content at install/stage time. `substituteClaudeVars` (`shared/vars.ts`) replaces the four content tokens `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_SKILL_DIR}` (skills only), and `${CLAUDE_PROJECT_DIR}` (project-scope only) in skill, command, and agent content (SUB-01/SUB-02). `substituteAndInject` (`bridges/mcp/substitute.ts`) applies Claude Code's rule to an MCP entry at stage time. It expands variables in five fields only: the `command`, `args` and `env` values of a stdio server, and the `url` and `headers` values of a remote server. In these fields, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, project-scope `${CLAUDE_PROJECT_DIR}` and `${VAR:-default}` resolve at install. A plain `${VAR}` stays in the entry, and pi-mcp-adapter expands it when it starts the server (MENV-01, AVAR-01, AVAR-02). See [Where variables expand](mcp-compatibility.md#where-variables-expand).

- **E -- runtime env injection.** Session-scoped values are set on Pi's live `process.env` and inherited by spawned children. At every `session_start`, `applySessionEnv` (`shared/session-env.ts`) sets `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID`, and the pi-only `CLAUDE_SESSION_ID` alias (SENV-01/02/03). At load and at every `session_start`, `applyMcpAdapterEnv` (`shared/session-env.ts`) also sets the pi-only `PI_CLAUDE_MARKETPLACE_EMPTY` to the empty string and `CLAUDE_PROJECT_DIR` to the working directory of the session (AVAR-01, AVAR-03). It does not set `CLAUDE_PROJECT_DIR`, and it removes any earlier value, when the directory name holds `$env:` or `{env:`, or ends in `$`, `{`, or the start of `$env` or `{env`. Bash and MCP children inherit both values. At load time -- the `resources_discover` handler, so on startup and `/reload`, not per session -- the PATH ledger appends each installed enabled plugin's `<pluginRoot>/bin` to `PATH`, recording the appended entries in the pi-only `PI_CLAUDE_MARKETPLACE_PATH` (PENV-01); an install or uninstall is reflected after the next `/reload`. Pi's bash tool spreads the full live `process.env` into every child, so these reach bash children. The two hook spawn lanes (`prepareEnv` in `bridges/hooks/dispatch-exec.ts` and `prepareAsyncEnv` in `bridges/hooks/async-rewake/registry.ts`) spread `...process.env` and then add `CLAUDE_PROJECT_DIR` (= cwd), `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, the session env, and -- on the SessionStart hook event only, on both lanes -- `CLAUDE_ENV_FILE` (HENV-01/02). MCP stdio servers inherit Pi's live `process.env` at spawn (see "MCP runtime env inheritance").

- **I -- install-time env injection.** MCP-only: `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` are written into each staged stdio server's `env` map at stage time by `substituteAndInject` (`bridges/mcp/substitute.ts`), at every scope, with plugin-declared keys winning over the injected defaults (MENV-02). `CLAUDE_PROJECT_DIR` is not injected. It reaches the server through Pi's process (E), and Claude Code injects only the same two variables (AVAR-01). These are install-stable values baked into the staged config -- distinct from E, which reaches a server only through the live `process.env` it inherits at spawn.

## Overview matrix

Legend: **S** = install-time substitution · **E** = runtime env injection · **I** = install-time env injection (staged MCP `env` map) · **⚠** = partial / scope- or event-gated delivery (see the row's note) · **--** = not applicable · **✗** = documented absence. The **Claude Code** column marks whether the variable exists upstream (✓) or is Pi-only (--). Footnote markers on a cell point to the matching subsection under "Divergences and documented absences".

| Variable                                | Claude Code | Skills | Commands | Agents | Bash | Hooks | MCP config | MCP env |
| --------------------------------------- | ----------- | ------ | -------- | ------ | ---- | ----- | ---------- | ------- |
| `CLAUDE_PLUGIN_ROOT`                    | ✓           | S      | S        | S      | --   | E     | S          | I       |
| `CLAUDE_PLUGIN_DATA`                    | ✓           | S      | S        | S      | --   | E     | S          | I       |
| `CLAUDE_SKILL_DIR`                      | ✓           | S      | --       | --     | --   | --    | --         | --      |
| `CLAUDE_PROJECT_DIR`                    | ✓           | S†     | S†       | S†     | E†   | E     | S / ⚠†     | E‡      |
| `CLAUDECODE`                            | ✓           | --     | --       | --     | E    | E     | --         | E‡      |
| `CLAUDE_CODE_SESSION_ID`                | ✓           | --     | --       | --     | E    | E     | --         | E‡      |
| `CLAUDE_ENV_FILE`                       | ✓           | --     | --       | --     | --   | E§    | --         | --      |
| `PATH` (plugin `bin` append)            | ✓           | --     | --       | --     | E    | E     | --         | E‡      |
| `CLAUDE_SESSION_ID` (pi-only)           | --          | --     | --       | --     | E    | E     | --         | E‡      |
| `PI_CLAUDE_MARKETPLACE_PATH` (pi-only)  | --          | --     | --       | --     | E    | E     | --         | E‡      |
| `PI_CLAUDE_MARKETPLACE_EMPTY` (pi-only) | --          | --     | --       | --     | E    | E     | --         | E‡      |
| `AI_AGENT` (pi-only)                    | --          | --     | --       | --     | E¶   | E¶    | --         | E¶      |
| `CLAUDE_CODE_REMOTE`                    | ✓           | --     | --       | --     | --   | ✗     | --         | --      |

- **†** -- In skill, command and agent content, the token resolves for project-scope installs only, and user-scope occurrences stay literal (SUB-02). An MCP entry resolves it at install for the project scope. A user-scope entry keeps `${CLAUDE_PROJECT_DIR}`, and pi-mcp-adapter expands it from Pi's process. Bash children inherit `CLAUDE_PROJECT_DIR`, which Claude Code does not set for Bash (AVAR-01). See "`CLAUDE_PROJECT_DIR` at user scope".
- **‡** -- reaches MCP servers only through Pi's live `process.env` at spawn time. The spawn-order caveat applies to every row. Session-switch staleness applies only to the session vars and `CLAUDE_PROJECT_DIR`. The `PATH` rows and `PI_CLAUDE_MARKETPLACE_EMPTY` do not change on a session switch. See "MCP runtime env inheritance".
- **§** -- exposed on the SessionStart hook event only, and Pi does not source the file back. See "`CLAUDE_ENV_FILE` is exposed but not sourced".
- **¶** -- Pi sets `AI_AGENT` on its own process at start, before any extension code runs. It has no spawn-order caveat. See "Pi-only `AI_AGENT`".

## Per-surface delivery

Each surface below lists the variables that apply, in the house register (`Variable | Claude Code | Pi | Notes`).

### Bash children

Pi's bash tool builds each child's env fresh, spreading the full live `process.env` (its only mutation prepends Pi's own managed bin dir to `PATH`) and re-deriving a fixed set of `PI_*` keys -- there is no prefix scrub, so the extension's `process.env` mutations reach every later bash child.

| Variable                                | Claude Code        | Pi  | Notes                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ------------------ | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CLAUDECODE`                            | ✓                  | ✓   | Set to `1` on Pi's live `process.env` at every `session_start` (SENV-01).                                                                                                                                                                                                                                                                                    |
| `CLAUDE_CODE_SESSION_ID`                | ✓                  | ✓   | The Pi session id (SENV-02); refreshed each `session_start` so it tracks the active session.                                                                                                                                                                                                                                                                 |
| `CLAUDE_SESSION_ID` (pi-only)           | --                 | ✓   | Pi-only alias of the session id (SENV-03); no upstream equivalent. See "Pi-only `CLAUDE_SESSION_ID` alias".                                                                                                                                                                                                                                                  |
| `PI_CLAUDE_MARKETPLACE_PATH` (pi-only)  | --                 | ✓   | Pi-only PATH-ledger bookkeeping var (PENV-01); records exactly the plugin `bin` dirs Pi appended. Visible to children. See "Pi-only `PI_CLAUDE_MARKETPLACE_PATH` PATH ledger".                                                                                                                                                                               |
| `PATH` (plugin `bin` append)            | ✓                  | ✓   | Each installed enabled plugin's `<pluginRoot>/bin` is appended (never prepended, so a plugin binary cannot shadow a system/Pi binary), deduplicated and idempotent; recomputed from install state at load/`/reload`, not per session (PENV-01).                                                                                                              |
| `CLAUDE_PROJECT_DIR`                    | ✓ (hooks/MCP only) | ✓   | Inherited from Pi's process, where this extension sets it to the working directory of the session at load and at every `session_start`. Claude Code's own bash children carry no `CLAUDE_PROJECT_DIR`. This is a divergence: Bash and every MCP server inherit `CLAUDE_PROJECT_DIR`, a project decision (AVAR-01). See "`CLAUDE_PROJECT_DIR` at user scope". |
| `PI_CLAUDE_MARKETPLACE_EMPTY` (pi-only) | --                 | ✓   | Inherited from Pi's process, where this extension keeps it set to the empty string (AVAR-03). See "Reserved `PI_CLAUDE_MARKETPLACE_EMPTY`".                                                                                                                                                                                                                  |
| `AI_AGENT` (pi-only)                    | --                 | ✓   | Set to `pi` by Pi itself at process start. See "Pi-only `AI_AGENT`".                                                                                                                                                                                                                                                                                         |

### Skills content

Skill content is the only surface that resolves the skill-scoped `${CLAUDE_SKILL_DIR}` token.

| Variable                | Claude Code | Pi  | Notes                                                                                                                |
| ----------------------- | ----------- | --- | -------------------------------------------------------------------------------------------------------------------- |
| `${CLAUDE_PLUGIN_ROOT}` | ✓           | ✓   | Substituted into skill content at install time (SUB-01).                                                             |
| `${CLAUDE_PLUGIN_DATA}` | ✓           | ✓   | Substituted into skill content at install time.                                                                      |
| `${CLAUDE_SKILL_DIR}`   | ✓           | ✓   | The skill's installed directory; skill-scoped, so only skill content resolves it (SUB-01).                           |
| `${CLAUDE_PROJECT_DIR}` | ✓           | ⚠   | Project-scope installs only; user-scope occurrences stay literal (SUB-02). See "`CLAUDE_PROJECT_DIR` at user scope". |

### Commands content

Command content does not resolve `${CLAUDE_SKILL_DIR}` (skill-scoped).

| Variable                | Claude Code | Pi  | Notes                                                                                                                |
| ----------------------- | ----------- | --- | -------------------------------------------------------------------------------------------------------------------- |
| `${CLAUDE_PLUGIN_ROOT}` | ✓           | ✓   | Substituted into command content at install time (SUB-01).                                                           |
| `${CLAUDE_PLUGIN_DATA}` | ✓           | ✓   | Substituted into command content at install time.                                                                    |
| `${CLAUDE_PROJECT_DIR}` | ✓           | ⚠   | Project-scope installs only; user-scope occurrences stay literal (SUB-02). See "`CLAUDE_PROJECT_DIR` at user scope". |

### Agents content

Agent content does not resolve `${CLAUDE_SKILL_DIR}` (skill-scoped).

| Variable                | Claude Code | Pi  | Notes                                                                                                                |
| ----------------------- | ----------- | --- | -------------------------------------------------------------------------------------------------------------------- |
| `${CLAUDE_PLUGIN_ROOT}` | ✓           | ✓   | Substituted into agent content at install time (SUB-01).                                                             |
| `${CLAUDE_PLUGIN_DATA}` | ✓           | ✓   | Substituted into agent content at install time.                                                                      |
| `${CLAUDE_PROJECT_DIR}` | ✓           | ⚠   | Project-scope installs only; user-scope occurrences stay literal (SUB-02). See "`CLAUDE_PROJECT_DIR` at user scope". |

### Hooks

Both hook spawn lanes deliver the same env set: the session triple comes from the shared `claudeSessionEnvFor` producer (identical by construction), the remaining keys are hand-mirrored between the lanes, and a drift-guard test pins whole-env parity (HENV-02). The async lane adds one pi-only marker of its own, `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH` -- the sole permitted lane difference. Each lane spreads `...process.env` first, then adds the keys below so the authoritative per-dispatch snapshot wins.

| Variable                                | Claude Code | Pi  | Notes                                                                                                                                                                                                                 |
| --------------------------------------- | ----------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE_PROJECT_DIR`                    | ✓           | ✓   | Set to the dispatch cwd on both lanes (HENV-01/02).                                                                                                                                                                   |
| `CLAUDE_PLUGIN_ROOT`                    | ✓           | ✓   | The plugin's install source; containment-guarded (NFR-10).                                                                                                                                                            |
| `CLAUDE_PLUGIN_DATA`                    | ✓           | ✓   | Per-plugin data dir; containment-guarded (NFR-10).                                                                                                                                                                    |
| `CLAUDECODE`                            | ✓           | ✓   | From the shared session-env producer (HENV-01).                                                                                                                                                                       |
| `CLAUDE_CODE_SESSION_ID`                | ✓           | ✓   | Same producer, both lanes.                                                                                                                                                                                            |
| `CLAUDE_SESSION_ID` (pi-only)           | --          | ✓   | Pi-only alias; present on both hook lanes. See "Pi-only `CLAUDE_SESSION_ID` alias".                                                                                                                                   |
| `PATH` (plugin `bin` append)            | ✓           | ✓   | Inherited via the `...process.env` spread; the appended plugin `bin` dirs are documented under "Bash children".                                                                                                       |
| `PI_CLAUDE_MARKETPLACE_PATH` (pi-only)  | --          | ✓   | Inherited via the `...process.env` spread; pi-only PATH ledger. See "Pi-only `PI_CLAUDE_MARKETPLACE_PATH` PATH ledger".                                                                                               |
| `PI_CLAUDE_MARKETPLACE_EMPTY` (pi-only) | --          | ✓   | Inherited via the `...process.env` spread (AVAR-03). See "Reserved `PI_CLAUDE_MARKETPLACE_EMPTY`".                                                                                                                    |
| `AI_AGENT` (pi-only)                    | --          | ✓   | Inherited via the `...process.env` spread. Pi sets it to `pi` at process start. See "Pi-only `AI_AGENT`".                                                                                                             |
| `CLAUDE_ENV_FILE`                       | ✓           | ⚠   | Path exposed on the SessionStart hook event only (both spawn lanes; under `<dataRoot>/_shared/`, containment-guarded, D-60-06). Pi does not source the file back. See "`CLAUDE_ENV_FILE` is exposed but not sourced". |
| `CLAUDE_CODE_REMOTE`                    | ✓           | ✗   | Intentionally unset -- Pi runs locally (documented absence).                                                                                                                                                          |

Inherited parent `CLAUDE_CODE_*` / `ANTHROPIC_*` vars also ride the `...process.env` spread; see "Inherited `CLAUDE_CODE_*` / `ANTHROPIC_*` vars are not scrubbed".

### MCP config substitution

Substitution follows Claude Code's rule. It covers five fields only: the `command`, `args` and `env` values of a stdio server, and the `url` and `headers` values of a remote server (AVAR-01). Every other field, the `oauth` values, the `env` values under `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA`, and all object keys stay literal.

| Variable                | Claude Code | Pi  | Notes                                                                                                                                                                                                                        |
| ----------------------- | ----------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `${CLAUDE_PLUGIN_ROOT}` | ✓           | ✓   | Substituted in the five fields at stage time (MENV-01).                                                                                                                                                                      |
| `${CLAUDE_PLUGIN_DATA}` | ✓           | ✓   | Substituted in the five fields at stage time.                                                                                                                                                                                |
| `${CLAUDE_PROJECT_DIR}` | ✓           | ⚠   | Substituted at stage time for project-scope installs. A user-scope entry keeps the reference, and pi-mcp-adapter expands it from Pi's process when it starts the server (AVAR-01). See "`CLAUDE_PROJECT_DIR` at user scope". |
| `${VAR:-default}`       | ✓           | ✓   | Resolved at install: written as `${VAR}` if `VAR` is set, and as the default text if it is not (AVAR-02).                                                                                                                    |
| `${VAR}`                | ✓           | ✓   | Kept for pi-mcp-adapter, which expands it from Pi's process when it starts the server. The install warns if `VAR` is not set (AVAR-04).                                                                                      |

pi-mcp-adapter knows more syntax than Claude Code, so the install escapes that syntax in literal text. See [Syntax that only pi-mcp-adapter knows](mcp-compatibility.md#syntax-that-only-pi-mcp-adapter-knows).

### MCP spawn env

Env injection targets stdio-shaped entries (those with a string `command`) only; url/http/sse entries never gain a synthesized env. Injected defaults come first and the declared env spreads over them, so plugin-declared keys win. The session vars are not written into config -- they are inherited from Pi's live `process.env` at spawn.

| Variable                                | Claude Code | Pi  | Notes                                                                                                                                                                                      |
| --------------------------------------- | ----------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CLAUDE_PLUGIN_ROOT`                    | ✓           | ✓   | Injected into each stdio server's `env`; plugin-declared keys win (MENV-02).                                                                                                               |
| `CLAUDE_PLUGIN_DATA`                    | ✓           | ✓   | Injected into each stdio server's `env`.                                                                                                                                                   |
| `CLAUDE_PROJECT_DIR`                    | ✓           | ✓   | Not injected into the `env` map at any scope. Inherited from Pi's process, where this extension sets it at load and at every `session_start` (AVAR-01). See "MCP runtime env inheritance". |
| `CLAUDECODE`                            | ✓           | ✓   | Inherited from Pi's live `process.env` at spawn. See "MCP runtime env inheritance".                                                                                                        |
| `CLAUDE_CODE_SESSION_ID`                | ✓           | ✓   | Inherited from `process.env`. See "MCP runtime env inheritance".                                                                                                                           |
| `CLAUDE_SESSION_ID` (pi-only)           | --          | ✓   | Inherited pi-only alias. See "MCP runtime env inheritance".                                                                                                                                |
| `PATH` (plugin `bin` append)            | ✓           | ✓   | Inherited from Pi's live `process.env` at spawn. See "MCP runtime env inheritance".                                                                                                        |
| `PI_CLAUDE_MARKETPLACE_PATH` (pi-only)  | --          | ✓   | Inherited pi-only PATH ledger. See "MCP runtime env inheritance".                                                                                                                          |
| `PI_CLAUDE_MARKETPLACE_EMPTY` (pi-only) | --          | ✓   | Inherited from Pi's process. It must stay set, because the written entries reference it (AVAR-03). See "Reserved `PI_CLAUDE_MARKETPLACE_EMPTY`".                                           |
| `AI_AGENT` (pi-only)                    | --          | ✓   | Inherited from Pi's process, with no spawn-order caveat. See "Pi-only `AI_AGENT`".                                                                                                         |

## Divergences and documented absences

The behaviors below are deliberate divergences from Claude Code or documented absences. Each is the single citable home for a caveat that the overview matrix and per-surface tables mark with a footnote -- the caveat text is not duplicated elsewhere.

### Inherited `CLAUDE_CODE_*` / `ANTHROPIC_*` vars are not scrubbed

Both hook lanes spread `...process.env` before adding the parity keys. When Pi itself runs nested inside a Claude Code session -- or under any parent that exported `CLAUDE_CODE_*` / `ANTHROPIC_*` -- those inherited vars ride the spread into every hook child. The bridge deliberately does **not** scrub them: the stance is non-interference, and no requirement authorized scrubbing. The related threat is dispositioned in the phase security register (code-review finding WR-02; accepted as T-91-01 / AR-91-01) -- an inherited session id is an internal identifier, not a credential.

### Pi-only `PI_CLAUDE_MARKETPLACE_PATH` PATH ledger

`PI_CLAUDE_MARKETPLACE_PATH` records exactly the plugin `bin` dirs the extension appended to `PATH`. It is an env var rather than module state because module top-level is re-evaluated fresh on `/reload` while `process.env` persists in-process -- the ledger must survive a reload so that a recompute removes only the entries it previously added and never a system or Pi entry (PENV-01, D-90-01). It is visible to child processes; a documented pi-only bookkeeping var with no upstream equivalent.

### Pi-only `CLAUDE_SESSION_ID` alias

`CLAUDE_SESSION_ID` is a pi-only alias of the session id, set alongside `CLAUDE_CODE_SESSION_ID` and `CLAUDECODE` from the single shared producer (`claudeSessionEnvFor`). It is present in bash children and on both hook lanes, and carries the same value as `CLAUDE_CODE_SESSION_ID` within one dispatch, so the three stay internally consistent (SENV-03, D-91-02). No upstream equivalent exists.

### `CLAUDE_ENV_FILE` is exposed but not sourced

Claude Code's `CLAUDE_ENV_FILE` is a round-trip contract: a SessionStart hook writes `KEY=VALUE` lines to the file at `$CLAUDE_ENV_FILE`, and the host then sources that file so subsequent bash commands and the session inherit those vars. Pi implements only the exposure half. Both hook spawn lanes set `CLAUDE_ENV_FILE` on the SessionStart event (`prepareEnv` in `bridges/hooks/dispatch-exec.ts`, `prepareAsyncEnv` in `bridges/hooks/async-rewake/registry.ts`; path under `<dataRoot>/_shared/`, containment-guarded, D-60-06), and the `_shared/` dir is pre-created so a hook can write to it. But nothing in the extension reads, parses, or sources that file back: Pi's bash tool's only `PATH`-related mutation is prepending its managed bin dir (see "Bash children"), and no `session_start` step loads the file. A variable a SessionStart hook writes to `$CLAUDE_ENV_FILE` is therefore inert under Pi -- it never reaches the session or later bash children. The path is exposed for a hook that reads it directly; the write-back-and-source side is not wired.

### MCP runtime env inheritance

pi-mcp-adapter starts Pi's MCP servers (behavior verified against pi-mcp-adapter 5.2.0). Its `resolveEnv` in `server-manager.ts` copies Pi's full live `process.env` into a stdio server's env, so the session vars set at `session_start` reach the server. It then resolves each declared `env` value through `resolveCommandSecretsRecord`, and the declared keys win over the inherited values. `resolveCommandSecret` (`utils.ts`) runs a value that starts with `!` as a shell command, turns a leading `!!` into a literal `!`, and interpolates any other value. An unset variable becomes the empty string. This extension never writes `literalEnv` or `inheritEnv`, so pi-mcp-adapter always interpolates `env` values and always copies Pi's environment. pi-mcp-adapter also interpolates `command`, `args`, `cwd` and `url`, resolves `headers` values like `env` values, and expands a leading `~` in `command` and `args`. The install writes each value so that this second expansion gives Claude Code's result (AVAR-03). See [Syntax that only pi-mcp-adapter knows](mcp-compatibility.md#syntax-that-only-pi-mcp-adapter-knows). Claude Code's stdio MCP spawn env carries `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID`, and `CLAUDE_PROJECT_DIR`, and Pi's servers get all three by inheritance. Two consequences follow from inheritance-at-spawn:

- **Spawn-order caveat.** A server spawned before the extension's session-start handler has run for that startup misses the session vars.
- **Session-switch staleness.** A server that keeps running across a session switch keeps its spawn-time env. The refreshed session id and a new `CLAUDE_PROJECT_DIR` do not reach a server that is already running. This half applies only to the session vars and `CLAUDE_PROJECT_DIR`. `PATH`, `PI_CLAUDE_MARKETPLACE_PATH` and `PI_CLAUDE_MARKETPLACE_EMPTY` do not change on a session switch, so only the spawn-order caveat applies to them.

### `CLAUDE_PROJECT_DIR` at user scope

Claude Code substitutes `${CLAUDE_PROJECT_DIR}` at invoke time, also for user-scope artifacts. Pi writes skill, command and agent content once at install time, when the project root of a future session is not known. So user-scope `${CLAUDE_PROJECT_DIR}` occurrences in that content stay **literal**, and no environment variable resolves them (SUB-02).

A user-scope MCP entry keeps `${CLAUDE_PROJECT_DIR}`. This extension sets `CLAUDE_PROJECT_DIR` on Pi's process to the working directory of the session, at load and at every `session_start`. pi-mcp-adapter expands the reference from there when it starts the server, so the server gets the current project, as in Claude Code (AVAR-01). The install does not report the variable as not set.

Bash children inherit the same value. Claude Code sets no `CLAUDE_PROJECT_DIR` for Bash, so this is a divergence, licensed as a project decision (AVAR-01). For the directory names that this extension does not export, see [The project directory at user scope](mcp-compatibility.md#the-project-directory-at-user-scope).

### Reserved `PI_CLAUDE_MARKETPLACE_EMPTY`

This extension sets `PI_CLAUDE_MARKETPLACE_EMPTY` to the empty string on Pi's process at load and at every `session_start` (AVAR-03). The MCP entries that it writes use a reference to this variable as a split token. pi-mcp-adapter expands the reference to nothing, so text such as `{env:NAME}` reaches the server unchanged. The variable must stay set, because pi-mcp-adapter refuses a server whose `url` references a variable that is not set. Bash children and hook children inherit it too. See [Syntax that only pi-mcp-adapter knows](mcp-compatibility.md#syntax-that-only-pi-mcp-adapter-knows).

### Pi-only `AI_AGENT`

Pi sets `AI_AGENT=pi` on its own process at start, before any extension code runs. Bash children, both hook lanes and MCP servers inherit it. Because Pi sets it before anything spawns, it has no spawn-order caveat and no session-switch staleness. This extension neither sets nor reads it. Claude Code has no equivalent variable.

### Withheld credentials

The install writes no environment value into `mcp-adapter.json`. Claude Code withholds some credentials from plugin servers, and this extension applies the same deny-list to the five fields that it expands (AVAR-05). The install never leaves a withheld reference for pi-mcp-adapter to expand, so a value set later does not reach the server through that field. The deny-list covers references in these fields only. A stdio server still inherits Pi's full process environment, so a credential set in Pi's environment reaches it by inheritance. See [Withheld credentials](mcp-compatibility.md#withheld-credentials).

## Not delivered (out of scope)

The following Claude Code variables are recognized but not delivered by the extension. They are listed here so a reader finds a recorded decision rather than silence; they are deliberately kept out of the overview matrix, which reflects delivered behavior.

- **`${user_config.*}` / `CLAUDE_PLUGIN_OPTION_*`** -- needs a plugin-options feature Pi does not have.
- **`CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_ENTRYPOINT`** -- identity and entrypoint semantics of a different host; Pi is not Claude Code and sets no host-identity var.
- **`CLAUDE_CODE_MCP_SERVER_NAME`, `CLAUDE_CODE_MCP_SERVER_URL`** (headersHelper vars) -- pi-mcp-adapter territory, not this extension's to inject.
- **`CLAUDE_EFFORT`** -- a Pi `thinkingLevel` mapping is possible but semantically approximate; deferred (EFRT-01).

One absence is recorded affirmatively rather than by silence:

- **`CLAUDE_CODE_REMOTE`** -- intentionally unset on hook spawns; Pi runs locally.
