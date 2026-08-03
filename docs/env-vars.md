# Environment variables

How the Claude plugin environment variables Claude Code exposes are delivered to plugin components once a plugin is installed under Pi. The table register mirrors [`docs/hooks-compatibility.md`](hooks-compatibility.md): a **Claude Code** ground-truth column against Pi's delivery. Claims here are transcribed from the shipped bridge sources, not from upstream docs — the Claude Code ground truth was verified against the Claude Code v2.1.212 binary and a live session env (DOC-06).

## Two delivery mechanisms

Pi delivers these variables through two disjoint mechanisms. The overview matrix marks every cell with which one applies.

- **S — install-time textual substitution.** Install-stable, per-plugin values are baked into content at install/stage time. `substituteClaudeVars` (`shared/vars.ts`) replaces the four content tokens `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_SKILL_DIR}` (skills only), and `${CLAUDE_PROJECT_DIR}` (project-scope only) in skill, command, and agent content (SUB-01/SUB-02). `substituteAndInject` (`bridges/mcp/substitute.ts`) deep-substitutes the three tokens `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and `${CLAUDE_PROJECT_DIR}` (project-scope only) across an MCP entry's `command`/`args`/`env` at stage time (MENV-01/03). A token whose value is absent passes through **literally** — never as an empty string.

- **E — runtime env injection.** Session-scoped values are set on Pi's live `process.env` and inherited by spawned children. At every `session_start` `applySessionEnv` (`shared/session-env.ts`) sets `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID`, and the pi-only `CLAUDE_SESSION_ID` alias (SENV-01/02/03), and the PATH ledger appends each installed enabled plugin's `<pluginRoot>/bin` to `PATH`, recording the appended entries in the pi-only `PI_CLAUDE_MARKETPLACE_PATH` (PENV-01). Pi's bash tool spreads the full live `process.env` into every child, so these reach bash children. The two hook spawn lanes (`prepareEnv` in `bridges/hooks/dispatch-exec.ts` and `prepareAsyncEnv` in `bridges/hooks/async-rewake/registry.ts`) spread `...process.env` and then add `CLAUDE_PROJECT_DIR` (= cwd), `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, the session env, and — on the SessionStart lane only — `CLAUDE_ENV_FILE` (HENV-01/02). MCP stdio servers inherit Pi's live `process.env` at spawn (see "MCP runtime env inheritance").

## Overview matrix

Legend: **S** = install-time substitution · **E** = runtime env injection · **—** = not applicable · **✗** = documented absence. The **Claude Code** column marks whether the variable exists upstream (✓) or is Pi-only (—). Footnote markers on a cell point to the matching subsection under "Divergences and documented absences".

| Variable                               | Claude Code | Skills | Commands | Agents | Bash | Hooks | MCP config | MCP env |
| -------------------------------------- | ----------- | ------ | -------- | ------ | ---- | ----- | ---------- | ------- |
| `CLAUDE_PLUGIN_ROOT`                   | ✓           | S      | S        | S      | —    | E     | S          | E       |
| `CLAUDE_PLUGIN_DATA`                   | ✓           | S      | S        | S      | —    | E     | S          | E       |
| `CLAUDE_SKILL_DIR`                     | ✓           | S      | —        | —      | —    | —     | —          | —       |
| `CLAUDE_PROJECT_DIR`                   | ✓           | S†     | S†       | S†     | —†   | E     | S†         | E†      |
| `CLAUDECODE`                           | ✓           | —      | —        | —      | E    | E     | —          | E‡      |
| `CLAUDE_CODE_SESSION_ID`               | ✓           | —      | —        | —      | E    | E     | —          | E‡      |
| `CLAUDE_ENV_FILE`                      | ✓           | —      | —        | —      | —    | E§    | —          | —       |
| `PATH` (plugin `bin` append)           | ✓           | —      | —        | —      | E    | E     | —          | E       |
| `CLAUDE_SESSION_ID` (pi-only)          | —           | —      | —        | —      | E    | E     | —          | E‡      |
| `PI_CLAUDE_MARKETPLACE_PATH` (pi-only) | —           | —      | —        | —      | E    | E     | —          | E       |
| `CLAUDE_CODE_REMOTE`                   | ✓           | —      | —        | —      | —    | ✗     | —          | —       |

- **†** — project-scope installs only. User-scope `${CLAUDE_PROJECT_DIR}` stays literal and no env key is injected; Pi sets none in bash children as deliberate parity. See "User-scope `${CLAUDE_PROJECT_DIR}` pass-through".
- **‡** — reaches MCP servers only through Pi's live `process.env` at spawn time, subject to the spawn-order and session-switch caveats. See "MCP runtime env inheritance".
- **§** — SessionStart hook lane only.

## Per-surface delivery

Each surface below lists the variables that apply, in the house register (`Variable | Claude Code | Pi | Notes`).

### Bash children

Pi's bash tool builds each child's env fresh, spreading the full live `process.env` (its only mutation prepends Pi's own managed bin dir to `PATH`) and re-deriving a fixed set of `PI_*` keys — there is no prefix scrub, so the `session_start` mutations above reach every later bash child.

| Variable                               | Claude Code        | Pi  | Notes                                                                                                                                                                                                                                   |
| -------------------------------------- | ------------------ | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDECODE`                           | ✓                  | ✓   | Set to `1` on Pi's live `process.env` at every `session_start` (SENV-01).                                                                                                                                                               |
| `CLAUDE_CODE_SESSION_ID`               | ✓                  | ✓   | The Pi session id (SENV-02); refreshed each `session_start` so it tracks the active session.                                                                                                                                            |
| `CLAUDE_SESSION_ID` (pi-only)          | —                  | ✓   | Pi-only alias of the session id (SENV-03); no upstream equivalent. See "Pi-only `CLAUDE_SESSION_ID` alias".                                                                                                                             |
| `PI_CLAUDE_MARKETPLACE_PATH` (pi-only) | —                  | ✓   | Pi-only PATH-ledger bookkeeping var (PENV-01); records exactly the plugin `bin` dirs Pi appended. Visible to children. See "Pi-only `PI_CLAUDE_MARKETPLACE_PATH` PATH ledger".                                                          |
| `PATH` (plugin `bin` append)           | ✓                  | ✓   | Each installed enabled plugin's `<pluginRoot>/bin` is appended (never prepended, so a plugin binary cannot shadow a system/Pi binary), deduplicated and idempotent (PENV-01).                                                           |
| `CLAUDE_PROJECT_DIR`                   | ✓ (hooks/MCP only) | —   | Claude Code's own bash children carry **no** `CLAUDE_PROJECT_DIR` (it is a hooks/MCP-only var upstream), so Pi sets none in bash children either — deliberate parity, not a gap. See "User-scope `${CLAUDE_PROJECT_DIR}` pass-through". |

## Divergences and documented absences

The behaviors below are deliberate divergences from Claude Code or documented absences. Each is the single citable home for a caveat that the overview matrix and per-surface tables mark with a footnote — the caveat text is not duplicated elsewhere.

## Not delivered (out of scope)

The following Claude Code variables are recognized but not delivered by this milestone. They are listed here so a reader finds a recorded decision rather than silence; they are deliberately kept out of the overview matrix, which reflects delivered behavior.
