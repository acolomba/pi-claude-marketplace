# Phase 4: Variable expansion at Claude Code parity - Context

**Gathered:** 2026-10-07
**Status:** Ready for planning

<domain>
## Phase Boundary

When a plugin MCP server is written to `mcp-adapter.json`, its variables are
rewritten so pi-mcp-adapter runs what Claude Code would run. No environment
value goes to disk. The adapter's own second expansion (`$env:`, `{env:}`,
`~/`, a leading `!`) cannot change a value, run a shell command, or deliver a
credential that Claude Code would blank.

Requirements: AVAR-01..05 (AVAR-03, AVAR-04 and AVAR-05 are amended below).
Migration of `mcp.json` entries is Phase 5. Live adapter status is Phase 6.
The written entry shape is final before Phase 5 moves entries.

**Precondition:** the pi-mcp-adapter floor moves from 5.0.0 to 5.1.0 in a quick
task before this phase is planned (D-04-12). Every adapter fact below was
checked against 5.0.0 and re-diffed against 5.1.0: `utils.ts`
(`interpolateEnvVars`, `expandHomePath`), `agent-plugin-provenance.ts`,
`claude-plugin-loader.ts` and the expansion call sites in `server-manager.ts`
are identical.

</domain>

<decisions>
## Implementation Decisions

Decision IDs are milestone-scoped and collide with older IDs already cited in
source. Source comments cite requirement IDs (AVAR-0N), never `D-04-NN`.

### Locked by requirements (recorded, not re-discussed)
- **D-04-01:** `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`, and in
  project scope `${CLAUDE_PROJECT_DIR}`, are expanded at install time in
  Claude's five fields only: stdio `command`, `args` and `env` values, and
  remote `url` and `headers` (AVAR-01). Today's whole-entry deep walk in
  `bridges/mcp/substitute.ts` narrows to these fields. The values of the `env`
  keys `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` are not expanded (Claude's
  `cLo` set). The injected stdio env stays `{CLAUDE_PLUGIN_ROOT,
  CLAUDE_PLUGIN_DATA, ...declared}`, declared keys winning.
- **D-04-02:** `${VAR:-default}` is resolved at install time with Claude's rule
  (AVAR-02): if `VAR` is set, empty included, write `${VAR}`; if it is unset,
  write the default text. Plain `${VAR}` stays in the file for the adapter's
  runtime expansion. No written entry, fixture or test output contains a
  resolved environment value.
- **D-04-03:** A leading `!` in an `env` or `headers` value is written as `!!`
  (AVAR-03). The adapter's `!!` path still interpolates the rest, which is the
  intended behavior.

### Adapter-only syntax (amends AVAR-03)
- **D-04-04:** `$env:NAME` and `{env:NAME}` in any of the five fields are
  written so the adapter outputs them as literal text, as Claude does. The
  construction relies on the adapter's three expansion passes (`${…}`, then
  `$env:…`, then `{env:…}`), each a single global replace that never re-reads
  its own output. `{env:X}` is written `{env:{env:E}X}`, and `$env:X` is
  written `$env{env:E}:X`. `E` is a variable reserved by this extension.
  Verified against the real adapter 5.0.0 functions (see `<compat_evidence>`).
  This also closes the leak where `{env:SECRET}` in `url`/`headers` bypasses
  the deny-list.
  — **Reversibility:** costly — it is entry content that Phase 5 migrates, and
  changing it again changes adapter definition hashes, so users re-approve
  project servers.
- **D-04-05:** The extension keeps `E` set to the empty string in Pi's
  process. Leaving it unset is not enough: in `url`, `resolveServerUrl` runs
  `getMissingEnvVars` on the raw text, finds `{env:E}`, and refuses the server
  when `E` is unset. Name and set point are the planner's (see Claude's
  Discretion).
- **D-04-06:** A leading `~` or `~/` in `command` or `args` cannot be kept
  literal: the adapter home-expands the already interpolated value, so no
  construction survives. A server with one makes the plugin
  `partially-available` with the existing aggregate reason `{unsupported mcp}`
  (house partial-install pattern, D-03-10). A normal install refuses with the
  `--partial` hint, `--partial` leaves that server out, and `info` names the
  server, the field and the blocking token. AVAR-03's "produces an install
  warning" wording is replaced by D-04-04 and D-04-06.
  — **Reversibility:** costly — a new arm in the closed `{unsupported mcp}`
  breakdown, pinned by catalog gates.

### Credential deny-list (amends AVAR-05)
- **D-04-07:** Mirror Claude Code 2.1.291. Its plain list is blanked in all
  five fields: Claude's own credentials, its session secrets, `OTEL_*`, and
  `INPUT_` variants. Its remote-sink list is also blanked in `url` and
  `headers`: cloud tokens, registry tokens, proxy and package-index variables,
  git-host tokens, the `GIT_CONFIG_*` and `CARGO_REGISTRIES_*_TOKEN` patterns,
  and the value rule for a `*_BASE_URL` that points at an Anthropic host. The
  lists are a static snapshot of the named sets the binary ships, pinned by a
  test that names the Claude Code version. The value rule is evaluated against
  the install-time environment. AVAR-05's "applied to `url` and `headers`"
  becomes "the plain list in all five fields, the remote-sink list in `url` and
  `headers`".
  — **Reversibility:** reversible — one data module and its test.
- **D-04-08:** A deny-listed reference gets Claude's load-time output, computed
  at install time. It is never left for the adapter to expand, so setting the
  variable later cannot leak it:
  - in `url`/`headers`, always `""`;
  - in the other fields, `""` when the variable is set at install; when it is
    unset, the `:-` default text if there is one, otherwise the literal
    `${NAME}` written as `${env:E}{NAME}` (D-04-04), plus the missing-variable
    warning.

### `${CLAUDE_PROJECT_DIR}` at user scope
- **D-04-09:** The extension sets `process.env.CLAUDE_PROJECT_DIR` to the
  session's cwd at session start, so a user-scope entry keeps
  `${CLAUDE_PROJECT_DIR}` and the adapter expands it at runtime to the current
  project, as Claude does for every scope. Project scope keeps install-time
  expansion (D-04-01), whose result is the same directory. Accepted side
  effect: bash children and every MCP child inherit `CLAUDE_PROJECT_DIR`,
  which Claude Code does not set for Bash (observed in a Claude Code 2.1.291
  bash child). The explicit `CLAUDE_PROJECT_DIR` injection into project-scope
  stdio env (MENV-03) becomes redundant; the planner may drop it.
  — **Reversibility:** reversible — one `session_start` assignment, a
  documented divergence and its test.

### Warnings (amends AVAR-04)
- **D-04-10:** The missing-variable warning (AVAR-04) and a blanked-credential
  warning are reported by every path that stages an entry: install, update,
  reinstall, enable, import, the reconcile cascade, and Phase 5's migration.
  They travel by the D-02-09 structured-notice route, not as a `warnings`
  string, which standalone verbs drop. Following Claude, a variable counts as
  missing only when it is unset and has no `:-`. A blanked-credential warning
  fires for `url`/`headers` when the blanked variable is set (Claude's
  remote-sink warning). Values are never printed, only names.
- **D-04-11:** `/claude:plugin info` shows, per plugin MCP server, the
  referenced variables that are unset now and the deny-listed ones that are
  blanked, computed from the current environment (read-only, no network,
  names only). This parallels Claude's `/plugin` Errors list. New wording is a
  closed-catalog amendment in `docs/output-catalog.md`.

### Adapter floor
- **D-04-12:** The `pi-mcp-adapter` optional peer floor moves to `>=5.1.0`,
  the first release whose `@earendil-works/pi-ai` peer admits Pi `^1.0.0`. The
  same quick task updates the `scripts/pi.sh` pin and the floor gates, and
  re-checks the 5.0.0 facts Phases 2–3 rely on (`mcp-adapter.json` grammar,
  the `ServerEntry` carried-field pin, naming). The README's "upstream issue"
  note on the `pi-ai` peer gap (PIFL-03) goes away. The Pi peer floor stays
  `>=1.0.0` (PIFL-01). Runs before planning; this phase's conformance test
  pins 5.1.0.

### Claude's Discretion
- Name of the reserved empty variable `E`, and where it is set (extension
  factory, `session_start`, or both), given that `lifecycle` is unset (lazy
  connect) and a carried user override could make a server eager.
- How the AVAR-03 conformance test reaches the real pinned adapter without
  making it a devDependency (PIFL-03, D-98-10). The `PI_SUBAGENTS_ROOT` peer
  test is the precedent: a scratch install named by an environment variable,
  with the zero-skip run recorded. Say plainly whether CI runs it.
- The per-field escape matrix covers every field the closed translator writes
  (D-03-07), including `oauth.*`, not only the five expansion fields. Build it
  from the adapter's real functions, not a re-typed copy (ROADMAP note).
- Module layout: extend `bridges/mcp/substitute.ts` or split a pure expansion
  module, under the fallow and sonarjs ceilings.
- The threat model the ROADMAP requires (secrets on disk, the deny-list,
  shell execution through `!`, the split-token dependency on adapter
  internals) is written at planning time.

</decisions>

<compat_evidence>
## Claude Code and adapter evidence records

Claude Code from the 2.1.291 binary
(`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.291/claude`,
`strings -a` dump, 2026-10-06). Adapter facts from the 5.0.0 package
(`~/.cache/pi-cm-phase3-research/rt/node_modules/pi-mcp-adapter`), diffed
against the 5.1.0 tarball on 2026-10-07.

- **Expansion pipeline (`uLo`).** Per string: `Ase` replaces
  `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PROJECT_DIR}` (`fo() ?? vr()`, project
  root or cwd, every scope) and `${CLAUDE_PLUGIN_DATA}`; then `A_t` replaces
  `${user_config.KEY}`; then `oq` expands the environment. stdio: `command`,
  `args`, and `env` except the keys `CLAUDE_PLUGIN_ROOT` and
  `CLAUDE_PLUGIN_DATA`, with env built as `{CLAUDE_PLUGIN_ROOT,
  CLAUDE_PLUGIN_DATA, ...declared}`. sse/http/ws: `url` and `headers` with
  `remoteSink: true`. High confidence.
- **Grammar (`oq`).** `/\$\{([A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?)\}/g` only. A
  set variable, empty included, gives its value; unset with `:-` gives the
  default text; unset without one stays literal and is reported in
  `missingVars`. No `$NAME`, `$env:`, `{env:}`, `~` or `!`. High confidence.
- **Deny-list (`U4`, `oq`).** `{plain, remoteSink}`. `plain` = `qur()`
  (Claude's own credential names, env keys matching `NDe`, including
  `OTEL_*`) plus `DNn` (`CLAUDE_CODE_OAUTH_REFRESH_TOKEN`, `MCP_CLIENT_SECRET`,
  … and `INPUT_` variants). `remoteSink` = `plain` plus `LNn` (`kqe` git-host
  tokens minus `GH_ENTERPRISE_TOKEN`/`HF_TOKEN`-style exclusions, plus `PNn`:
  `AWS_CONTAINER_AUTHORIZATION_TOKEN`, `CLOUDSDK_AUTH_ACCESS_TOKEN`,
  `NPM_TOKEN`, `CARGO_REGISTRY_TOKEN`, `PYPI_TOKEN`, `TWINE_PASSWORD`,
  `HTTPS_PROXY`, `PIP_INDEX_URL`, `GOPROXY`, …). Remote sinks also blank the
  `ZEe` name patterns and the `eRe` value rule (`*_BASE_URL` pointing at an
  Anthropic host). A plain-field match is blanked only when set; a remote-sink
  match is always `""` and warns when set. A feature-flagged value check
  (`tRe`) also exists; its trigger is not decoded. Structure high confidence,
  full membership medium: `qur()` and `kqe` are assembled at runtime and must
  be extracted exactly during research.
- **Warnings.** "Missing environment variables in plugin MCP config: X"
  (warn, plus an `mcp-config-invalid` error that `/plugin` lists; the server
  still loads). "MCP server config references credential variable(s) that are
  never expanded toward a remote server: X (read as empty)". High confidence.
- **Bash env.** A Claude Code 2.1.291 bash child has no `CLAUDE_PROJECT_DIR`
  (observed 2026-10-06). Basis for the D-04-09 side-effect note.
- **Adapter expansion.** `interpolateEnvVars` runs three sequential global
  replaces; an unset variable becomes `""`. `args` get
  `expandHomePath(interpolateEnvVars(arg))`, and `command` gets
  `resolveConfigPath`, the same order. `env` and `headers` go through
  `resolveCommandSecret`: a single leading `!` runs a shell command, and `!!`
  drops one `!` and interpolates the rest. `url` refuses a missing variable
  before interpolating. The literal mode (`isBuiltInAgentPlugin`) is keyed on
  a JS Symbol that JSON config cannot set. Its documentation calls the syntax
  intentional (`docs/servers.md`: "Environment interpolation remains
  intentional").
- **Split-token probe (2026-10-06, adapter 5.0.0 `dist/utils.js`).**
  `{env:{env:E}SECRET}` -> `{env:SECRET}`; `$env{env:E}:SECRET` ->
  `$env:SECRET`; `${env:E}{SECRET}` -> `${SECRET}`; `~/{env:E}x` and
  `{env:E}~/x` -> `/home/<user>/x` as `args`; `url`
  `https://h/{env:{env:E}SECRET}` throws when `E` is unset and gives
  `https://h/{env:SECRET}` when `E=""`.
- **Upstream stance.** pi-mcp-adapter #570 reported this exact re-expansion
  for its Agent Plugins loader. #572 fixed it with the internal Symbol, and the
  maintainer declined "an external-loader literal mode" for the public API
  (closed 2026-09-13).
- **Official marketplace survey** (`anthropics/claude-plugins-official` at
  `d4226d06`, 2026-10-05; external sources read at their pinned SHAs). 315
  plugins, 171 with MCP servers, 217 servers. None uses a leading `~`,
  `$env:`, `{env:}`, a leading `!` or a bare `$NAME`, and none references
  `${CLAUDE_PROJECT_DIR}`. `${VAR:-default}` appears 6 times in 3 plugins
  (datadog `${DD_API_KEY:-}` in headers, logfire `url`, aws-devops-agent
  `url`). 28 distinct `${NAME}` variables, mostly tokens in `headers`/`env`.
  `${user_config.*}` appears in `env`, `args` and `url`. `userConfig` is
  already an unsupported component.

</compat_evidence>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — AVAR-01..05 (AVAR-03, -04, -05 amended by D-04-04/06, D-04-10/11, D-04-07)
- `.planning/ROADMAP.md` §Phase 4 — success criteria and the threat-model note

### Prior decisions
- `.planning/phases/03-claude-code-tool-names-and-tool-search/03-CONTEXT.md` — D-03-07 closed translator, D-03-10 `{unsupported mcp}` partial pattern, D-03-18 malformed rule
- `.planning/phases/02-adapter-file-delivery/02-CONTEXT.md` — D-02-09 structured-notice route
- `.planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-CONTEXT.md` — peer floors, PIFL-03

### Milestone research
- `.planning/research/FEATURES.md` — U5–U9 (Claude), A6 (adapter expansion), TS-6/TS-7, G-2..G-5, G-12
- `.planning/research/PITFALLS.md` — second expansion, secrets on disk
- `.planning/research/SUMMARY.md` — Open Decisions item 3
- `.planning/BACKLOG.md` — MENVX-01, ENVLIT-01, ENVDOC-01 (closed by this phase)

### Upstream and companions
- `skills/claude-code-compat-research/SKILL.md` — evidence method
- pi-mcp-adapter 5.1.0 `utils.ts`, `server-manager.ts` (stdio spawn, `resolveEnv`, HTTP headers), `docs/servers.md`, `docs/auth.md`
- https://github.com/nicobailon/pi-mcp-adapter/issues/570 — upstream stance on literal mode
- https://code.claude.com/docs/en/mcp, https://code.claude.com/docs/en/plugins-reference

### Output vocabulary
- `docs/output-catalog.md` — `{unsupported mcp}` breakdown, warning tokens, info lines
- `docs/env-vars.md` — ENVDOC-01 rewrite (Phase 7 owns the full docs pass)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bridges/mcp/substitute.ts`: `substituteAndInject`, `VAR_RE` and the single-pass replacer. It narrows to the five fields and gains `:-`, the deny-list, the split-token literals and `!!`.
- `bridges/mcp/adapter-entry.ts`: `translatedEntry` and `stampServers` call substitution before `translateMcpServer`. Warnings already flow out of `stampServers`.
- `domain/mcp-server-features.ts`: the closed table (D-03-07). The resolver's `{unsupported mcp}` arm (D-03-10) is where the D-04-06 `~/` check lands.
- `shared/session-env.ts` and its `session_start` wiring: the home for the D-04-09 `CLAUDE_PROJECT_DIR` export and possibly the D-04-05 reserved variable.
- `orchestrators/plugin/info.ts`: MCP server rows (D-03-16) gain the D-04-11 lines.

### Established Patterns
- Partial install: resolver `partially-available`, an aggregate reason, `--partial`, and an info breakdown.
- Closed-catalog amendments pinned by `tests/architecture/compat-01-no-expansion.test.ts` and `notify-closed-set-locks.test.ts`.
- Peer tests rooted by an environment variable (`PI_SUBAGENTS_ROOT`) for real companion code that is not a dependency.

### Integration Points
- Every staging path (install, update, reinstall, enable, import, reconcile) and Phase 5 migration, through the D-02-09 notice route.
- `session_start` handler in `index.ts`.

</code_context>

<specifics>
## Specific Ideas

- Fixtures: datadog's `${DD_API_KEY:-}` (empty default) and logfire's
  `url` default, both from real official plugins.
- The conformance test asserts split-token outputs with `E` set to `""`,
  including the `url` case, and asserts the unset-`E` `url` refusal as the
  reason D-04-05 exists.
- Research extracts the exact membership of `qur()`/`J5t` and `kqe` from the
  2.1.291 binary before the snapshot is written.

</specifics>

<deferred>
## Deferred Ideas

- Upstream bug report: pi-mcp-adapter's `claudePlugins` loader replaces only
  `${CLAUDE_PLUGIN_ROOT}` and applies native interpolation to Claude plugin
  servers (same class as #570). Needs the operator's go-ahead to file.
- Upstream feature request: a JSON-settable Claude-syntax interpolation mode
  per entry. Likely declined per #570.
- Blank Pi provider keys (`OPENAI_API_KEY`, …) for plugin MCP servers
  (REQUIREMENTS Future).
- Phase 3 follow-up: official plugins using `type: "streamable-http"`
  (cloudinary ×5, catalyst-by-zoho) or `type: "url"` (windsor-ai) resolve
  unavailable under D-03-18. Check how Claude treats these types; the binary
  mentions `streamable-http`.

</deferred>

---

*Phase: 04-variable-expansion-at-claude-code-parity*
*Context gathered: 2026-10-07*
