# Environment variables

How the Claude plugin environment variables Claude Code exposes are delivered to plugin components once a plugin is installed under Pi. The table register mirrors [`docs/hooks-compatibility.md`](hooks-compatibility.md): a **Claude Code** ground-truth column against Pi's delivery. Claims here are transcribed from the shipped bridge sources, not from upstream docs -- the Claude Code ground truth was verified against the Claude Code v2.1.212 binary and a live session env (DOC-06).

## Delivery mechanisms

Pi delivers these variables through three mechanisms. The overview matrix marks every cell with which one applies.

- **S -- install-time textual substitution.** Install-stable, per-plugin values are baked into content at install/stage time. `substituteClaudeVars` (`shared/vars.ts`) replaces the four content tokens `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_SKILL_DIR}` (skills only), and `${CLAUDE_PROJECT_DIR}` (project-scope only) in skill, command, and agent content (SUB-01/SUB-02). `substituteAndInject` (`bridges/mcp/substitute.ts`) deep-substitutes the three tokens `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and `${CLAUDE_PROJECT_DIR}` (project-scope only) across every string value at any nesting depth of an MCP entry at stage time (MENV-01/03). A token whose value is absent passes through **literally** -- never as an empty string.

- **E -- runtime env injection.** Session-scoped values are set on Pi's live `process.env` and inherited by spawned children. At every `session_start`, `applySessionEnv` (`shared/session-env.ts`) sets `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID`, and the pi-only `CLAUDE_SESSION_ID` alias (SENV-01/02/03). At load time -- the `resources_discover` handler, so on startup and `/reload`, not per session -- the PATH ledger appends each installed enabled plugin's `<pluginRoot>/bin` to `PATH`, recording the appended entries in the pi-only `PI_CLAUDE_MARKETPLACE_PATH` (PENV-01); an install or uninstall is reflected after the next `/reload`. Pi's bash tool spreads the full live `process.env` into every child, so these reach bash children. The two hook spawn lanes (`prepareEnv` in `bridges/hooks/dispatch-exec.ts` and `prepareAsyncEnv` in `bridges/hooks/async-rewake/registry.ts`) spread `...process.env` and then add `CLAUDE_PROJECT_DIR` (= cwd), `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, the session env, and -- on the SessionStart hook event only, on both lanes -- `CLAUDE_ENV_FILE` (HENV-01/02). MCP stdio servers inherit Pi's live `process.env` at spawn (see "MCP runtime env inheritance").

- **I -- install-time env injection.** MCP-only: `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` (plus, for project-scope installs, `CLAUDE_PROJECT_DIR`) are written into each staged stdio server's `env` map at stage time by `substituteAndInject` (`bridges/mcp/substitute.ts`), with plugin-declared keys winning over the injected defaults (MENV-02/03). These are install-stable values baked into the staged config -- distinct from E, which reaches a server only through the live `process.env` it inherits at spawn.

## Overview matrix

Legend: **S** = install-time substitution · **E** = runtime env injection · **I** = install-time env injection (staged MCP `env` map) · **⚠** = partial / scope- or event-gated delivery (see the row's note) · **--** = not applicable · **✗** = documented absence. The **Claude Code** column marks whether the variable exists upstream (✓) or is Pi-only (--). Footnote markers on a cell point to the matching subsection under "Divergences and documented absences".

| Variable                               | Claude Code | Skills | Commands | Agents | Bash | Hooks | MCP config | MCP env |
| -------------------------------------- | ----------- | ------ | -------- | ------ | ---- | ----- | ---------- | ------- |
| `CLAUDE_PLUGIN_ROOT`                   | ✓           | S      | S        | S      | --   | E     | S          | I       |
| `CLAUDE_PLUGIN_DATA`                   | ✓           | S      | S        | S      | --   | E     | S          | I       |
| `CLAUDE_SKILL_DIR`                     | ✓           | S      | --       | --     | --   | --    | --         | --      |
| `CLAUDE_PROJECT_DIR`                   | ✓           | S†     | S†       | S†     | --†  | E     | S†         | I†      |
| `CLAUDECODE`                           | ✓           | --     | --       | --     | E    | E     | --         | E‡      |
| `CLAUDE_CODE_SESSION_ID`               | ✓           | --     | --       | --     | E    | E     | --         | E‡      |
| `CLAUDE_ENV_FILE`                      | ✓           | --     | --       | --     | --   | E§    | --         | --      |
| `PATH` (plugin `bin` append)           | ✓           | --     | --       | --     | E    | E     | --         | E‡      |
| `CLAUDE_SESSION_ID` (pi-only)          | --          | --     | --       | --     | E    | E     | --         | E‡      |
| `PI_CLAUDE_MARKETPLACE_PATH` (pi-only) | --          | --     | --       | --     | E    | E     | --         | E‡      |
| `CLAUDE_CODE_REMOTE`                   | ✓           | --     | --       | --     | --   | ✗     | --         | --      |

- **†** -- project-scope installs only. User-scope `${CLAUDE_PROJECT_DIR}` stays literal and no env key is injected; Pi sets none in bash children as deliberate parity. See "User-scope `${CLAUDE_PROJECT_DIR}` pass-through".
- **‡** -- reaches MCP servers only through Pi's live `process.env` at spawn time, subject to the spawn-order caveat (all rows) and, for the session vars only, session-switch staleness -- the `PATH` rows do not change on a session switch. See "MCP runtime env inheritance".
- **§** -- exposed on the SessionStart hook event only, and Pi does not source the file back. See "`CLAUDE_ENV_FILE` is exposed but not sourced".

## Per-surface delivery

Each surface below lists the variables that apply, in the house register (`Variable | Claude Code | Pi | Notes`).

### Bash children

Pi's bash tool builds each child's env fresh, spreading the full live `process.env` (its only mutation prepends Pi's own managed bin dir to `PATH`) and re-deriving a fixed set of `PI_*` keys -- there is no prefix scrub, so the extension's `process.env` mutations reach every later bash child.

| Variable                               | Claude Code        | Pi  | Notes                                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------ | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDECODE`                           | ✓                  | ✓   | Set to `1` on Pi's live `process.env` at every `session_start` (SENV-01).                                                                                                                                                                       |
| `CLAUDE_CODE_SESSION_ID`               | ✓                  | ✓   | The Pi session id (SENV-02); refreshed each `session_start` so it tracks the active session.                                                                                                                                                    |
| `CLAUDE_SESSION_ID` (pi-only)          | --                 | ✓   | Pi-only alias of the session id (SENV-03); no upstream equivalent. See "Pi-only `CLAUDE_SESSION_ID` alias".                                                                                                                                     |
| `PI_CLAUDE_MARKETPLACE_PATH` (pi-only) | --                 | ✓   | Pi-only PATH-ledger bookkeeping var (PENV-01); records exactly the plugin `bin` dirs Pi appended. Visible to children. See "Pi-only `PI_CLAUDE_MARKETPLACE_PATH` PATH ledger".                                                                  |
| `PATH` (plugin `bin` append)           | ✓                  | ✓   | Each installed enabled plugin's `<pluginRoot>/bin` is appended (never prepended, so a plugin binary cannot shadow a system/Pi binary), deduplicated and idempotent; recomputed from install state at load/`/reload`, not per session (PENV-01). |
| `CLAUDE_PROJECT_DIR`                   | ✓ (hooks/MCP only) | --  | Claude Code's own bash children carry **no** `CLAUDE_PROJECT_DIR` (it is a hooks/MCP-only var upstream), so Pi sets none in bash children either -- deliberate parity, not a gap. See "User-scope `${CLAUDE_PROJECT_DIR}` pass-through".        |

### Skills content

Skill content is the only surface that resolves the skill-scoped `${CLAUDE_SKILL_DIR}` token.

| Variable                | Claude Code | Pi  | Notes                                                                                                                             |
| ----------------------- | ----------- | --- | --------------------------------------------------------------------------------------------------------------------------------- |
| `${CLAUDE_PLUGIN_ROOT}` | ✓           | ✓   | Substituted into skill content at install time (SUB-01).                                                                          |
| `${CLAUDE_PLUGIN_DATA}` | ✓           | ✓   | Substituted into skill content at install time.                                                                                   |
| `${CLAUDE_SKILL_DIR}`   | ✓           | ✓   | The skill's installed directory; skill-scoped, so only skill content resolves it (SUB-01).                                        |
| `${CLAUDE_PROJECT_DIR}` | ✓           | ⚠   | Project-scope installs only; user-scope occurrences stay literal (SUB-02). See "User-scope `${CLAUDE_PROJECT_DIR}` pass-through". |

### Commands content

Command content does not resolve `${CLAUDE_SKILL_DIR}` (skill-scoped).

| Variable                | Claude Code | Pi  | Notes                                                                                                                             |
| ----------------------- | ----------- | --- | --------------------------------------------------------------------------------------------------------------------------------- |
| `${CLAUDE_PLUGIN_ROOT}` | ✓           | ✓   | Substituted into command content at install time (SUB-01).                                                                        |
| `${CLAUDE_PLUGIN_DATA}` | ✓           | ✓   | Substituted into command content at install time.                                                                                 |
| `${CLAUDE_PROJECT_DIR}` | ✓           | ⚠   | Project-scope installs only; user-scope occurrences stay literal (SUB-02). See "User-scope `${CLAUDE_PROJECT_DIR}` pass-through". |

### Agents content

Agent content does not resolve `${CLAUDE_SKILL_DIR}` (skill-scoped).

| Variable                | Claude Code | Pi  | Notes                                                                                                                             |
| ----------------------- | ----------- | --- | --------------------------------------------------------------------------------------------------------------------------------- |
| `${CLAUDE_PLUGIN_ROOT}` | ✓           | ✓   | Substituted into agent content at install time (SUB-01).                                                                          |
| `${CLAUDE_PLUGIN_DATA}` | ✓           | ✓   | Substituted into agent content at install time.                                                                                   |
| `${CLAUDE_PROJECT_DIR}` | ✓           | ⚠   | Project-scope installs only; user-scope occurrences stay literal (SUB-02). See "User-scope `${CLAUDE_PROJECT_DIR}` pass-through". |

### Hooks

Both hook spawn lanes deliver the same env set: the session triple comes from the shared `claudeSessionEnvFor` producer (identical by construction), the remaining keys are hand-mirrored between the lanes, and a drift-guard test pins whole-env parity (HENV-02). The async lane adds one pi-only marker of its own, `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH` -- the sole permitted lane difference. Each lane spreads `...process.env` first, then adds the keys below so the authoritative per-dispatch snapshot wins.

| Variable                               | Claude Code | Pi  | Notes                                                                                                                                                                                                                 |
| -------------------------------------- | ----------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE_PROJECT_DIR`                   | ✓           | ✓   | Set to the dispatch cwd on both lanes (HENV-01/02).                                                                                                                                                                   |
| `CLAUDE_PLUGIN_ROOT`                   | ✓           | ✓   | The plugin's install source; containment-guarded (NFR-10).                                                                                                                                                            |
| `CLAUDE_PLUGIN_DATA`                   | ✓           | ✓   | Per-plugin data dir; containment-guarded (NFR-10).                                                                                                                                                                    |
| `CLAUDECODE`                           | ✓           | ✓   | From the shared session-env producer (HENV-01).                                                                                                                                                                       |
| `CLAUDE_CODE_SESSION_ID`               | ✓           | ✓   | Same producer, both lanes.                                                                                                                                                                                            |
| `CLAUDE_SESSION_ID` (pi-only)          | --          | ✓   | Pi-only alias; present on both hook lanes. See "Pi-only `CLAUDE_SESSION_ID` alias".                                                                                                                                   |
| `PATH` (plugin `bin` append)           | ✓           | ✓   | Inherited via the `...process.env` spread; the appended plugin `bin` dirs are documented under "Bash children".                                                                                                       |
| `PI_CLAUDE_MARKETPLACE_PATH` (pi-only) | --          | ✓   | Inherited via the `...process.env` spread; pi-only PATH ledger. See "Pi-only `PI_CLAUDE_MARKETPLACE_PATH` PATH ledger".                                                                                               |
| `CLAUDE_ENV_FILE`                      | ✓           | ⚠   | Path exposed on the SessionStart hook event only (both spawn lanes; under `<dataRoot>/_shared/`, containment-guarded, D-60-06). Pi does not source the file back. See "`CLAUDE_ENV_FILE` is exposed but not sourced". |
| `CLAUDE_CODE_REMOTE`                   | ✓           | ✗   | Intentionally unset -- Pi runs locally (documented absence).                                                                                                                                                          |

Inherited parent `CLAUDE_CODE_*` / `ANTHROPIC_*` vars also ride the `...process.env` spread; see "Inherited `CLAUDE_CODE_*` / `ANTHROPIC_*` vars are not scrubbed".

### MCP config substitution

Substitution is whole-entry and deep: every string value at any nesting depth of the entry is substituted (a `url`, `headers`, `type`, or any custom field on an http/sse entry included, not just `command`/`args`/`env`). Object keys are never substituted.

| Variable                | Claude Code | Pi  | Notes                                                                                                                                                         |
| ----------------------- | ----------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `${CLAUDE_PLUGIN_ROOT}` | ✓           | ✓   | Deep-substituted across the entry at stage time (MENV-01).                                                                                                    |
| `${CLAUDE_PLUGIN_DATA}` | ✓           | ✓   | Deep-substituted across the entry at stage time.                                                                                                              |
| `${CLAUDE_PROJECT_DIR}` | ✓           | ⚠   | Project-scope installs only; user scope omits the key so the token passes through literally (MENV-03). See "User-scope `${CLAUDE_PROJECT_DIR}` pass-through". |

### MCP spawn env

Env injection targets stdio-shaped entries (those with a string `command`) only; url/http/sse entries never gain a synthesized env. Injected defaults come first and the declared env spreads over them, so plugin-declared keys win. The session vars are not written into config -- they are inherited from Pi's live `process.env` at spawn.

| Variable                               | Claude Code | Pi  | Notes                                                                                                      |
| -------------------------------------- | ----------- | --- | ---------------------------------------------------------------------------------------------------------- |
| `CLAUDE_PLUGIN_ROOT`                   | ✓           | ✓   | Injected into each stdio server's `env`; plugin-declared keys win (MENV-02).                               |
| `CLAUDE_PLUGIN_DATA`                   | ✓           | ✓   | Injected into each stdio server's `env`.                                                                   |
| `CLAUDE_PROJECT_DIR`                   | ✓           | ⚠   | Injected for project-scope installs only (MENV-03). See "User-scope `${CLAUDE_PROJECT_DIR}` pass-through". |
| `CLAUDECODE`                           | ✓           | ✓   | Inherited from Pi's live `process.env` at spawn. See "MCP runtime env inheritance".                        |
| `CLAUDE_CODE_SESSION_ID`               | ✓           | ✓   | Inherited from `process.env`. See "MCP runtime env inheritance".                                           |
| `CLAUDE_SESSION_ID` (pi-only)          | --          | ✓   | Inherited pi-only alias. See "MCP runtime env inheritance".                                                |
| `PATH` (plugin `bin` append)           | ✓           | ✓   | Inherited from Pi's live `process.env` at spawn. See "MCP runtime env inheritance".                        |
| `PI_CLAUDE_MARKETPLACE_PATH` (pi-only) | --          | ✓   | Inherited pi-only PATH ledger. See "MCP runtime env inheritance".                                          |

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

Pi's MCP servers are spawned by pi-mcp-adapter (behavior verified against 2.10.0). Its `server-manager.ts::resolveEnv` builds a stdio server's env as `{...process.env, ...interpolated(config.env)}` -- the server inherits Pi's full live `process.env` (so the session vars set at `session_start` reach it), and declared config keys win over the inherited values. Interpolation (`${VAR}` / `$env:VAR`) applies to `env` values, `cwd`, `headers`, and `bearerToken`, with an unknown var resolving to the empty string -- but **not** to `command` or `args`. This matches Claude Code, whose stdio MCP spawn env injects `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID`, and `CLAUDE_PROJECT_DIR`. Two consequences follow from inheritance-at-spawn:

- **Spawn-order caveat.** A server spawned before the extension's session-start handler has run for that startup misses the session vars.
- **Session-switch staleness.** A server that keeps running across a session switch retains its spawn-time env; the refreshed session id does not propagate to an already-running server. This half is scoped to the session vars -- `PATH` and `PI_CLAUDE_MARKETPLACE_PATH` do not change on a session switch, so only the spawn-order caveat applies to them.

### User-scope `${CLAUDE_PROJECT_DIR}` pass-through

Claude Code substitutes `${CLAUDE_PROJECT_DIR}` at invoke time, even for user-scope artefacts. Pi materializes content once at install time, when the project root of a future session is unknowable, so user-scope `${CLAUDE_PROJECT_DIR}` occurrences stay **literal** and no env var rescues them (SUB-02). Pi sets no `CLAUDE_PROJECT_DIR` in bash children either -- deliberate parity, because Claude Code's own bash children carry none (it is a hooks/MCP-only var upstream). For MCP, user-scope installs omit the substitution key entirely and inject no `CLAUDE_PROJECT_DIR` into the server env. The related user-scope disposition is recorded in the phase security register as T-92-06.

## Not delivered (out of scope)

The following Claude Code variables are recognized but not delivered by the extension. They are listed here so a reader finds a recorded decision rather than silence; they are deliberately kept out of the overview matrix, which reflects delivered behavior.

- **`${user_config.*}` / `CLAUDE_PLUGIN_OPTION_*`** -- needs a plugin-options feature Pi does not have.
- **`CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_ENTRYPOINT`** -- identity and entrypoint semantics of a different host; Pi is not Claude Code and sets no host-identity var.
- **`CLAUDE_CODE_MCP_SERVER_NAME`, `CLAUDE_CODE_MCP_SERVER_URL`** (headersHelper vars) -- pi-mcp-adapter territory, not this extension's to inject.
- **`CLAUDE_EFFORT`** -- a Pi `thinkingLevel` mapping is possible but semantically approximate; deferred (EFRT-01).

Two absences are recorded affirmatively rather than by silence:

- **`CLAUDE_CODE_REMOTE`** -- intentionally unset on hook spawns; Pi runs locally.
- **User-scope MCP `CLAUDE_PROJECT_DIR`** -- not injected into a user-scope MCP server's env, because the project root is unknowable at install time (see "User-scope `${CLAUDE_PROJECT_DIR}` pass-through").
