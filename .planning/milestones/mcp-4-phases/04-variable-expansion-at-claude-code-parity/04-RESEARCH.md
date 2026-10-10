# Phase 4: Variable expansion at Claude Code parity - Research

**Researched:** 2026-10-07
**Domain:** Install-time variable expansion of plugin MCP entries written to pi-mcp-adapter 5.1.0's `mcp-adapter.json`, escaped against the adapter's own runtime expansion, with Claude Code 2.1.291's credential deny-list
**Confidence:** HIGH for the adapter facts (5.1.0 source read and its real `dist/` functions executed this session, including a 462,790-case bounded-exhaustive conformance probe). HIGH for Claude Code's expansion rule, list membership and warning text (verbatim from the 2.1.291 binary, cross-checked with the official MCP docs). MEDIUM for the design recommendations.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Decision IDs are milestone-scoped and collide with older IDs already cited in
source. Source comments cite requirement IDs (AVAR-0N), never `D-04-NN`.

#### Locked by requirements (recorded, not re-discussed)
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

#### Adapter-only syntax (amends AVAR-03)
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

#### Credential deny-list (amends AVAR-05)
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

#### `${CLAUDE_PROJECT_DIR}` at user scope
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

#### Warnings (amends AVAR-04)
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

#### Adapter floor
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

### Deferred Ideas (OUT OF SCOPE)
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
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AVAR-01 | ROOT/DATA and project-scope PROJECT_DIR expanded at install, in Claude's five fields only | §Claude's expansion pipeline (Ase then oq, `cLo` keys); §Per-field escape matrix (which written fields are Claude-expanded vs literal); §Where each change lands (substitute.ts narrows, translate-first order) |
| AVAR-02 | `${VAR:-default}` resolved with Claude's rule; plain `${VAR}` left for the adapter; no env value on disk or in tests | §Claude's rule decision table (`oq`); §Serializer; §Validation (sentinel test: every referenced variable set to a unique sentinel, assert no sentinel in the written file) |
| AVAR-03 (amended by D-04-04/06) | `!` → `!!`; `$env:`/`{env:}`/`${digit…}` written literal via split tokens; leading `~` → `{unsupported mcp}`; conformance through the pinned adapter's real functions; closes MENVX-01, ENVLIT-01 | §Per-field escape matrix; §Serializer incl. the NEW kept-reference boundary guard (probe: 0 vs 102 mismatches); §Conformance harness (`PI_MCP_ADAPTER_ROOT`); §`literalEnv` finding closes ENVLIT-01 |
| AVAR-04 (amended by D-04-10/11) | Missing-variable warning on every staging path via the D-02-09 notice route; info shows live unset/blanked names | §Warning semantics (Claude's exact rule, ordering, dedup, debug-log vs `/plugin` error); §Where each change lands (`McpConfigNotice` kinds already flow through every staging path); §info composition |
| AVAR-05 (amended by D-04-07/08) | Claude's plain list in all five fields, remote-sink list in url/headers, version-pinned snapshot, proven by a security test | §Claude Code 2.1.291 deny-list membership (exact lists, patterns, value rule, mode-gated sets); `04-EVIDENCE-claude-2.1.291.txt` (verbatim source); §Threat model |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Upstream parity:** Claude Code's behavior is the default. A divergence needs a recorded decision ID or a Pi capability gap; "simpler" is not a license, it goes to the user as a question. [CITED: AGENTS.md]
- **Output channel (IL-2):** user-visible messages only through `shared/notification-dispatch.ts` (fallow `architecture/notify-chokepoint`). The new warnings go through `notifyMcpConfigNotices`, never a direct `ctx.ui.notify`. [CITED: AGENTS.md, ARCHITECTURE.md]
- **No telemetry, English only** (IL-1, IL-4). [CITED: AGENTS.md]
- **File ops atomic (NFR-1); containment (NFR-10):** writes stay in `<scopeRoot>/mcp-adapter.json`. Nothing new is written. [CITED: AGENTS.md]
- **Network policy (NFR-5):** `info`, `list` and the variable computation are network-free; no `platform/git` import in new `domain/` or `orchestrators/` modules (ESLint BLOCK F default-deny). [CITED: ARCHITECTURE.md]
- **Recovery (NFR-2/3):** no fix needs a Pi restart; `/reload` suffices. Setting `process.env` survives `/reload`. [CITED: AGENTS.md]
- **Quality bar (NFR-6):** `npm run check` green: typecheck, ESLint (`sonarjs/cognitive-complexity: 15`, the sonarjs recommended regex rules), fallow (`maxCognitive: 15`, `maxCyclomatic: 20`, dupes, boundaries, rule pack), Prettier, source/test pairing, 100% direct coverage per source-test pair. [CITED: CONVENTIONS.md, STACK.md]
- **TypeScript rules:** read `skills/typescript-google-style-review/SKILL.md`, `skills/typescript-comments/SKILL.md`, and for tests `skills/typescript-unit-testing/SKILL.md` + `-review`. Comments cite requirement IDs (AVAR-0N), never `D-04-NN`, phase or plan numbers. [CITED: AGENTS.md, CONTEXT.md]
- **Architecture zones:** `domain` may import only `shared`/`platform`; `bridges-mcp` may import `domain`/`persistence`/`shared`/`platform`; `entry` (index.ts) may import `shared` but not `domain`. [VERIFIED: .fallowrc.json boundaries read via node this session]
- **Verification policy:** `skills/local-verification/SKILL.md`: hook runs `check:commit`; GSD gates run `npm run check`; never `--no-verify`. [CITED: skills/local-verification/SKILL.md]
- **Git:** never commit to `main`; Conventional Commits; no history rewrite. [CITED: AGENTS.md]
- **GSD records:** every plan SUMMARY carries `## Threat Flags`. [CITED: AGENTS.md]
- **Dependency injection over test-only seams** (environment read from an injected map, not a module global). [CITED: CONVENTIONS.md]

## Summary

Claude Code 2.1.291 expands a plugin MCP server in one well-defined pipeline (`uLo`): `Ase` replaces the exact tokens `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PROJECT_DIR}` and `${CLAUDE_PLUGIN_DATA}`, then `oq` runs one global replace with `/\$\{([A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?)\}/g` over the result. That is the whole Claude grammar. Porting `oq` into a pure `domain/` tokenizer that emits text segments and kept-reference segments, plus the static deny-list snapshot, gives every install-time decision D-04-01/02/07/08 require, and the same tokenizer feeds the D-04-11 `info` lines. [VERIFIED: 2.1.291 binary, `04-EVIDENCE-claude-2.1.291.txt`; CITED: code.claude.com/docs/en/mcp]

pi-mcp-adapter 5.1.0 then re-expands what we write. Its `interpolateEnvVars` runs three sequential global replaces (`${\w+}`, `$env:\w+`, `{env:\w+}`), each over the previous pass's output, and the inserted values are re-read by the later passes. The D-04-04 split tokens make plugin-authored literal text survive. **New finding:** split tokens on literal text are not enough. A plugin can write `{env${UNSET}:ANTHROPIC_API_KEY}` in a header: Claude sends it literally, but the adapter turns the unset `${UNSET}` into `""` in pass 1 and pass 3 then expands `{env:ANTHROPIC_API_KEY}`, bypassing the deny-list. A bounded-exhaustive probe through the real 5.1.0 `interpolateEnvVars` found 102 such mismatches without a guard and 0 in 462,790 cases with one: insert `{env:E}` before a kept `${VAR}` whenever the preceding literal ends with `$`, `$e`, `$en`, `$env`, `{`, `{e`, `{en` or `{env`. The guard is mandatory. [VERIFIED: probe run against `/var/tmp/pi-cm-p4-adapter/node_modules/pi-mcp-adapter` 5.1.0, output in §Appendix B]

The binary also corrects four facts recorded in CONTEXT (see §Evidence corrections). The most important: `ANTHROPIC_API_KEY` is on the remote-sink list only, not the plain list, so a stdio `env` value `${ANTHROPIC_API_KEY}` expands normally in Claude. The `*_BASE_URL` value rule blanks a base URL whose **value embeds a credential** (a heuristic, `JA`), not one that "points at an Anthropic host". The official docs say the same. [VERIFIED: binary; CITED: code.claude.com/docs/en/mcp "Credential Variables That Read As Empty"]

**Primary recommendation:** Build three pure units and wire them in: (1) `domain/claude-credential-denylist.ts`, a version-pinned (`2.1.291`) snapshot of literal name sets plus the static name patterns and the value rule; (2) `domain/claude-mcp-variables.ts`, a port of Claude's `Ase`+`oq` that returns segments, `missing` and `blanked` per field; (3) `bridges/mcp/adapter-escape.ts`, which serializes segments for the adapter (merge adjacent text, escape `$env:`/`{env:`/`${\w+}`, boundary guard before kept references, `!`→`!!` on `env`/`headers`). Translate first with the closed table, then expand only the written fields. Set `E` (`PI_CLAUDE_MARKETPLACE_EMPTY` recommended) and `CLAUDE_PROJECT_DIR` in the extension factory and again in the existing `session_start` handler. Prove AVAR-03 with an integration conformance test that imports the real adapter from `PI_MCP_ADAPTER_ROOT`, and add a CI step that installs the pinned 5.1.0 into `$RUNNER_TEMP` so it actually runs.

## Evidence corrections to CONTEXT.md

The planner should carry these into plans and docs. None reverses a locked decision; three change what "mirror Claude" means in code.

| CONTEXT says | 2.1.291 binary / adapter 5.1.0 says | Impact |
|---|---|---|
| plain = `qur()` "(Claude's own credential names …)" (implies `ANTHROPIC_API_KEY`) | `qur()` = `J5t` (18 names: `CLAUDE_CODE_OAUTH_TOKEN`, five `*_FILE_DESCRIPTOR`, bridge/BG tokens) + live env keys matching `NDe` + mode-gated `Gqe`/`Voo`/`Gur` + 10 literal `CLAUDE_CODE_*` names + `mqe` (18 session-state names). `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and `AWS_BEARER_TOKEN_BEDROCK` appear only in `Gqe` (host-managed provider mode) and `Gur` (HIPAA tier). [VERIFIED: binary lines 412843, 412154] | In default mode `${ANTHROPIC_API_KEY}` in a stdio `env`/`args`/`command` expands. It is blanked only in `url`/`headers` (via `No`). AVAR-05's "ANTHROPIC_API_KEY and peers … url and headers" is exactly right. |
| remote-sink `LNn` = "`kqe` git-host tokens …" | `kqe` = `No` (95 cloud, CI, registry, webhook and Claude credential names) + `INPUT_` variants. `GITHUB_TOKEN`/`GH_TOKEN` are **not** in any MCP list (they appear only in the subprocess-scrub list `Eso`). `MNn` removes `GH_ENTERPRISE_TOKEN`, `GITHUB_ENTERPRISE_TOKEN`, `HF_TOKEN`, `HUGGING_FACE_HUB_TOKEN`, `HUGGINGFACEHUB_API_TOKEN`. [VERIFIED: binary lines 412689, 419309] | A `${GITHUB_TOKEN}` header is NOT blanked by Claude; do not add it. |
| value rule: "`*_BASE_URL` that points at an Anthropic host" | `eRe(name, value)` = `name ∈ FNn` (15 `*_BASE_URL` names ×`INPUT_`) AND `JA(value)`. `JA` is a credential-in-value detector: URL userinfo (`user:pass@`), token-shaped strings (`gh[opusr]_`, `sk-`, `AKIA`, `eyJ` …), `Bearer`/`Basic`/`Authorization` forms, private-key headers, Slack/Discord/Teams webhook URLs. [VERIFIED: binary line 412690; CITED: docs "A provider base URL such as ANTHROPIC_BASE_URL still expands … unless the URL's value itself embeds a credential"] | Port `JA` verbatim (≈40 lines of regexes) or ask the operator (Open Question 1). A credential-free `ANTHROPIC_BASE_URL` set at install is written `${ANTHROPIC_BASE_URL}` (kept). |
| "Warnings … credential variable(s) that are never expanded toward a remote server" listed as a warning | It is a debug-log line (`t(…, {level:"warn"})`; `t` writes to the debug log). Only the missing-variable case also pushes a user-visible `mcp-config-invalid` error into `/plugin`. [VERIFIED: binary lines 411788 (`function t(e,n={level:"debug"}){z().log(e,n)}`), 419309, 421033; CITED: docs "Claude Code names it in a debug-log line"] | D-04-10 makes the blanked-credential warning user-visible: a deliberate visibility divergence. Record it in docs (Phase 7) and in the plan's decision note. |
| "The literal mode (`isBuiltInAgentPlugin`) is keyed on a JS Symbol that JSON config cannot set" | True for `args`/`cwd`/`headers`. For stdio `env`, `literalEnv: true` IS JSON-settable (`types.ts:507`, `server-manager.ts:1185`, `config.ts:942`) and disables both `!` commands and all interpolation for `env`. [VERIFIED: adapter 5.1.0 source] | Does not help: Claude's `env` needs runtime `${VAR}` expansion, which `literalEnv` disables, and writing resolved values is forbidden (AVAR-02). Recording this answers ENVLIT-01: not used. |

## Architectural Responsibility Map

This is a Pi extension, so the tiers are the project's own layers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Claude deny-list snapshot (names, patterns, value rule) | `domain/` | — | Pure data + predicates; consumed by the bridge (staging) and by `orchestrators/plugin/info.ts` (D-04-11). Domain may import only `shared`/`platform`. |
| Claude expansion rule (`Ase`+`oq` port) → segments, missing, blanked | `domain/` | — | Pure, env injected as a parameter; shared by staging and info. |
| Leading-`~` classification (D-04-06) | `domain/mcp-server-features.ts` | `domain/resolver-types.ts` (schema union) | It is a resolver verdict (`partially-available`), decided before any write. |
| Adapter serialization (split tokens, boundary guard, `!!`) | `bridges/mcp/` | — | Adapter-specific encoding of entry content; "every change to entry content belongs in this module or the table" (`adapter-entry.ts` header). |
| Field selection, env injection, order of operations | `bridges/mcp/adapter-entry.ts` + `substitute.ts` | `domain/mcp-server-features.ts` (closed table) | Existing seam (`translatedEntry`, `stampServers`). |
| Missing / blanked notices on every staging path | `bridges/mcp/stage.ts` (produce) | `shared/notification-dispatch.ts` (render), orchestrators (route, already wired) | D-02-09 route: `StageMcpCommitResult.notices` → `mcpConfigNotices` → `notifyMcpConfigNotices`. |
| Live unset/blanked names in info (D-04-11) | `orchestrators/plugin/info.ts` | `shared/notification-types.ts` + `notification-grammar.ts` | Composition site stamps; renderer only formats. |
| Reserved `E` and `CLAUDE_PROJECT_DIR` in `process.env` | `shared/session-env.ts` | `index.ts` (factory + `session_start`) | Existing env-mutation leaf; entry zone may import `shared`. |
| Conformance against the real adapter | `tests/integration/` | CI `integration` job | Optional peer, never a devDependency. |

## Standard Stack

No new runtime or dev dependency. Everything is TypeScript in the existing stack (`typebox` already present for schemas). [VERIFIED: package.json read]

| Component | Version | Purpose | Notes |
|-----------|---------|---------|-------|
| pi-mcp-adapter (optional peer, test-time only) | 5.1.0 (`peerDependencies["pi-mcp-adapter"]: ">=5.1.0"`, package.json:61) | Conformance target: real `dist/utils.js`, `dist/mcp-auth-flow.js`, `dist/mcp-auth-fetch.js` | Installed in a scratch prefix (`npm install --prefix <dir> pi-mcp-adapter@5.1.0 --ignore-scripts --omit=peer`, 43 packages, 4 s, 90 MB), named by `PI_MCP_ADAPTER_ROOT`. Never a devDependency (PIFL-03). [VERIFIED: installed this session] |
| `node:test` | Node 24 (CI), 26.10.0 local | All new tests | Existing. |

**Installation (test-time only, never in package.json):**
```bash
npm install --prefix /var/tmp/pi-mcp-adapter-5.1.0 pi-mcp-adapter@5.1.0 --ignore-scripts --omit=peer --no-audit --no-fund
export PI_MCP_ADAPTER_ROOT=/var/tmp/pi-mcp-adapter-5.1.0/node_modules/pi-mcp-adapter
```

`dist/utils.js` imports only Node builtins and `strip-json-comments`; `dist/mcp-auth-flow.js` and `dist/mcp-auth-fetch.js` import from the installed tree without any Pi peer. All three imported cleanly with `--omit=peer`. [VERIFIED: probe import this session]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| pi-mcp-adapter@5.1.0 | npm | 5.1.0 published 2026-10-06 (1 day); package exists since 2.x | 534,097/wk | github.com/nicobailon/pi-mcp-adapter | [SUS] reason `too-new` (seam check) | Already the operator-selected peer floor (D-04-12, quick task 261007-9a2). No `postinstall` (`npm view … scripts.postinstall` empty); integrity `sha512-2oIaOK5Y…MYnSw==`. Test-time scratch install only, with `--ignore-scripts`. Planner keeps a `checkpoint:human-verify` before the first scratch install per protocol. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** pi-mcp-adapter@5.1.0 (age only). Note the release cadence: 3.2.0 (2026-09-28) to 5.1.0 (2026-10-06) is five releases and two majors in eight days, which matters for the split-token dependency (Threat T8). [VERIFIED: `npm view pi-mcp-adapter time`]

## Claude Code 2.1.291: expansion pipeline and rule

Verbatim sources are in `.planning/phases/04-variable-expansion-at-claude-code-parity/04-EVIDENCE-claude-2.1.291.txt` (extracted this session from the `strings -a` dump of `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.291/claude`).

### Pipeline (`uLo`, dump line 421033)

- `Y(value, remoteSink)` = `oq(A_t(Ase(value)), env=undefined, r=undefined, {remoteSink, blankList: U4()})`. `A_t` replaces `${user_config.KEY}` (unsupported component here; untouched text survives both Claude and the adapter literally because `.` is outside both grammars).
- **stdio** (`type` undefined or `"stdio"`): `command = Y(command)`; `args[i] = Y(args[i])`; `env = {CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: data, ...declared}` and then every key **not** in `cLo = {"CLAUDE_PLUGIN_ROOT","CLAUDE_PLUGIN_DATA"}` gets `Y(value)`. A declared value under those two keys is not expanded at all, not even by `Ase`.
- **sse/http/ws**: `url = Y(url, true)`, each `headers` value `Y(v, true)`. Header and env **keys** are never expanded.
- `Ase` (dump line 416445) uses three literal regexes, so only the exact forms `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_DATA}` are replaced, and `oq` then re-scans the substituted text (a path containing `${X}` would be expanded by `oq`). `${CLAUDE_PLUGIN_ROOT:-x}` is not touched by `Ase`; `oq` treats it as an ordinary variable.
- `oauth.*`, `description` and every other field are copied without expansion. [VERIFIED: `ke={...e}` with only the listed fields reassigned]

### Rule (`oq`, dump line 419309), per `${NAME}` / `${NAME:-default}` match

`Ue = NAME.toUpperCase()`; `he` = `blankList.plain` (plain fields) or `blankList.remoteSink` (url/headers). `tRe` terms are gated off outside Claude's subprocess-scrub mode (see below).

| Field class | Denied? | Set at expansion? | Claude output | Lists |
|---|---|---|---|---|
| plain | `he.has(Ue)` | set (incl. `""`) | `""` | `blankedVars` (no warning) |
| plain | `he.has(Ue)` | unset, `:-d` | `d` | — |
| plain | `he.has(Ue)` | unset, no default | literal `${NAME}` | `missingVars` |
| remote | `he.has(Ue) \|\| ZEe(Ue) \|\| eRe(Ue, value)` | any | `""` (a `:-` default is ignored) | `blankedVars` only if set; warning (debug log) only if set |
| any | not denied | set | value | — |
| any | not denied | unset, `:-d` | `d` (inserted literally, never re-expanded) | — |
| any | not denied | unset, no default | literal `${NAME}` | `missingVars` |

Membership is case-insensitive (uppercased name); the value lookup is exact-case. `eRe` with an unset variable is false (value undefined), so an unset `${ANTHROPIC_BASE_URL}` in a url is "missing", not blanked. [VERIFIED: binary]

### Warnings (dump lines 419309, 421033)

- Missing: per server, after all fields, `D(S).join(", ")` (deduplicated in first-seen order [ASSUMED: `D` is the uniq helper; consistent with its use `t0e=D(Wqe.flatMap(…))`]). Debug log `Missing environment variables in plugin MCP config: A, B` plus a user-visible `/plugin` error `{type:"mcp-config-invalid", plugin, serverName, validationError:"Missing environment variables: A, B"}`. The server still loads; only a remote server whose url is then not a valid `URL` gets a `configError` (`env_missing`). Field order of first-seen: `command`, `args` in order, `env` in object order of `{ROOT, DATA, ...declared}` (cLo keys skipped), `url`, `headers` in key order.
- Blanked: per `oq` call (one url string or one header value), only remote fields, only names that were set: debug log `MCP server config references credential variable(s) that are never expanded toward a remote server: A (read as empty)`. Not deduplicated across fields. Not in `/plugin`.
- The docs confirm both: missing shows in `claude mcp list`; the credential line is found with `claude --debug-file`. [CITED: code.claude.com/docs/en/mcp]

## Claude Code 2.1.291 deny-list membership

Representation for the static snapshot (D-04-07): uppercase literal-name sets plus pure predicates for the patterns. Names computed from the live environment collapse into patterns because `oq` only blanks a plain name when it is set, and a set name with `NDe(upper)` true is exactly a member of `Object.keys(env).filter(NDe)`. [VERIFIED: reasoning over the verbatim code]

### Plain set (blanked in all five fields when set)

Literal names, 64 unique after uppercasing (computed from the evidence file this session):

- `J5t` (18): `CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR`, `CLAUDE_CODE_GATEWAY_TOKEN_FILE_DESCRIPTOR`, `CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR`, `CLAUDE_CODE_WEBSOCKET_AUTH_FILE_DESCRIPTOR`, `CCR_AGENT_PROXY_TOKEN_FILE_DESCRIPTOR`, `CLAUDE_CODE_ARTIFACTS_API_TOKEN`, `CLAUDE_CODE_SLACK_TAG_TOKEN`, `CLAUDE_CODE_HFI_BEARER_TOKEN`, `CLAUDE_BRIDGE_OAUTH_TOKEN`, `CLAUDE_TRUSTED_DEVICE_TOKEN`, `AGENT_PROXY_AUTH_TOKEN`, `CLAUDE_CODE_MCP_SERVE_AUTH_TOKEN`, `CLAUDE_BG_AUTH_SNAPSHOT_PATH`, `CLAUDE_BG_SOCKET_TOKENS_PATH`, `CLAUDE_BG_RV_AUTH`, `CLAUDE_BG_PTY_AUTH`, `CLAUDE_BG_CLAIM_AUTH`. (No `INPUT_` variants for `J5t` in `qur()`.)
- `qur()` literals (10): `CLAUDE_CODE_SUBSCRIPTION_TYPE`, `CLAUDE_CODE_RATE_LIMIT_TIER`, `CLAUDE_CODE_PLUGIN_ATTRIBUTION`, `CLAUDE_CODE_SKILL_ATTRIBUTION`, `CLAUDE_CODE_BRIDGE_CHILD_AUTO_DEFAULT`, `CLAUDE_CODE_BRIDGE_CHILD_ARTIFACT`, `CLAUDE_CODE_BRIDGE_CHILD_MACHINE_SETTINGS`, `CLAUDE_CODE_CONFIG_PROBE`, `CLAUDE_CODE_HOST_PROMPT_SUPERSEDES_RECORD`, `CLAUDE_CODE_MCP_SERVE_SETTINGS`.
- `mqe`+`mrt` (18): `CLAUDE_CODE_SESSION_KIND`, `CLAUDE_BG_SOURCE`, `CLAUDE_BG_ISOLATION`, `CLAUDE_BG_BACKEND`, `CLAUDE_CODE_SESSION_NAME`, `CLAUDE_CODE_RESUME_INTERRUPTED_TURN`, `CLAUDE_CODE_RESUME_INTERRUPTED_TURN_MAX_AGE_MS`, `CLAUDE_CODE_RESUME_PROMPT`, `CLAUDE_CODE_RESUME_REASON`, `CLAUDE_CODE_RESUME_SOURCE_ALIVE`, `CLAUDE_BG_POST_CLEAR_RESPAWN`, `CLAUDE_BG_SESSION_PERMISSION_RULES`, `CLAUDE_BG_MEMORY_TOGGLED_OFF`, `CLAUDE_BG_AUTO_MEMORY_OFF`, `CLAUDE_BG_WORKSPACE_TRUSTED`, `CLAUDE_CODE_RELAUNCH_HOME_TRUST`, `CLAUDE_BG_DISPATCHER_SUBSCRIPTION_TYPE`, `CLAUDE_BG_DISPATCHER_RATE_LIMIT_TIER`.
- `DNn` = `ANn` + `INPUT_` variants (18): `CLAUDE_CODE_OAUTH_REFRESH_TOKEN`, `CLAUDE_SESSION_INGRESS_TOKEN_FILE`, `CLAUDE_CODE_HOST_CREDS_FILE`, `CLAUDE_CODE_MESSAGING_TOKEN`, `MCP_CLIENT_SECRET`, `MCP_XAA_IDP_CLIENT_SECRET`, `ENVIRONMENT_SERVICE_KEY`, `SELF_HOSTED_RUNNER_POOL_SECRET`, `SELF_HOSTED_RUNNER_ENVIRONMENT_SECRET`, each also as `INPUT_<name>`.

Pattern (code, not data): `NDe(upper)`: strip one leading `INPUT_`, then true when `startsWith("CLAUDE_CODE_ARTIFACT") && endsWith("_BASE_URL")` (`Wur`), or the name is `CLAUDE_CODE_MEMORY_API_BASE_URL`/`CLAUDE_CODE_MEMORY_API_TOKEN` (`Kke`/`br`), or `startsWith("OTEL_")`, or equals `CLAUDE_CODE_OTEL_DIAG_STDERR`.

### Remote-sink set (url/headers; always `""`)

Remote = plain ∪ `LNn` (216 unique uppercase) ∪ pattern `ZEe` ∪ value rule `eRe`. Literal union: 275 unique.

- `LNn` = (`No` + `INPUT_` variants) minus names whose `INPUT_`-stripped form is in `MNn` (`GH_ENTERPRISE_TOKEN`, `GITHUB_ENTERPRISE_TOKEN`, `HF_TOKEN`, `HUGGING_FACE_HUB_TOKEN`, `HUGGINGFACEHUB_API_TOKEN`) + (`PNn` + `INPUT_` variants).
- `No` (95): `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDE_CODE_ARTIFACTS_API_TOKEN`, `CLAUDE_CODE_MEMORY_API_TOKEN`, `CLAUDE_CODE_SLACK_TAG_TOKEN`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_FOUNDRY_API_KEY`, `ANTHROPIC_FOUNDRY_AUTH_TOKEN`, `ANTHROPIC_AWS_API_KEY`, `ANTHROPIC_CUSTOM_HEADERS`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_BEARER_TOKEN_BEDROCK`, `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_GHA_CREDS_PATH`, `AZURE_CLIENT_SECRET`, `IDENTITY_HEADER`, `MSI_SECRET`, `AZURE_CLIENT_CERTIFICATE_PATH`, `AZURE_CLIENT_CERTIFICATE_PASSWORD`, `AZURE_PASSWORD`, `AZURE_FEDERATED_TOKEN_FILE`, `AWS_WEB_IDENTITY_TOKEN_FILE`, `AWS_CONTAINER_CREDENTIALS_RELATIVE_URI`, `AWS_CONTAINER_CREDENTIALS_FULL_URI`, `AWS_CONTAINER_AUTHORIZATION_TOKEN`, `AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE`, `CLOUDSDK_AUTH_ACCESS_TOKEN`, `GOOGLE_OAUTH_ACCESS_TOKEN`, `CLAUDE_CODE_OAUTH_REFRESH_TOKEN`, `HF_TOKEN`, `HUGGING_FACE_HUB_TOKEN`, `HUGGINGFACEHUB_API_TOKEN`, `NODE_AUTH_TOKEN`, `NUGET_AUTH_TOKEN`, `CARGO_REGISTRY_TOKEN`, `TWINE_PASSWORD`, `TWINE_USERNAME`, `PYPI_TOKEN`, `PYPI_API_TOKEN`, `UV_PUBLISH_TOKEN`, `UV_PUBLISH_PASSWORD`, `UV_PUBLISH_USERNAME`, `FLIT_PASSWORD`, `FLIT_USERNAME`, `HATCH_INDEX_AUTH`, `HATCH_INDEX_USER`, `GEM_HOST_API_KEY`, `MATURIN_PYPI_TOKEN`, `MATURIN_PASSWORD`, `MATURIN_USERNAME`, `CONAN_LOGIN_USERNAME`, `CONAN_PASSWORD`, `ANACONDA_API_TOKEN`, `BINSTAR_API_TOKEN`, `VAULT_TOKEN`, `VAULT_AUTH_TOKEN`, `VAULT_ROLE_ID`, `VAULT_SECRET_ID`, `CONSUL_HTTP_TOKEN`, `CONSUL_HTTP_AUTH`, `NOMAD_TOKEN`, `NOMAD_HTTP_AUTH`, `CI_REGISTRY_USER`, `CI_DEPLOY_USER`, `JF_USER`, `FASTLANE_SESSION`, `MATCH_GIT_BASIC_AUTHORIZATION`, `SONAR_TOKEN`, `SONARQUBE_SCANNER_PARAMS`, `SONAR_SCANNER_JSON_PARAMS`, `SLACK_WEBHOOK_URL`, `SLACK_WEBHOOK`, `DISCORD_WEBHOOK`, `DISCORD_WEBHOOK_URL`, `TEAMS_WEBHOOK_URL`, `MS_TEAMS_WEBHOOK_URI`, `ANTHROPIC_IDENTITY_TOKEN`, `ANTHROPIC_IDENTITY_TOKEN_FILE`, `CLOUDSDK_AUTH_ACCESS_TOKEN_FILE`, `CLOUDSDK_AUTH_AUTHORIZATION_TOKEN_FILE`, `AZURE_AUTH_LOCATION`, `ACTIONS_ID_TOKEN_REQUEST_TOKEN`, `ACTIONS_ID_TOKEN_REQUEST_URL`, `ACTIONS_RUNTIME_TOKEN`, `ACTIONS_RUNTIME_URL`, `ALL_INPUTS`, `VSS_NUGET_EXTERNAL_FEED_ENDPOINTS`, `ARTIFACTS_CREDENTIALPROVIDER_EXTERNAL_FEED_ENDPOINTS`, `VSS_NUGET_ACCESSTOKEN`, `ARTIFACTS_CREDENTIALPROVIDER_ACCESSTOKEN`, `COMPOSER_AUTH`, `OVERRIDE_GITHUB_TOKEN`, `DEFAULT_WORKFLOW_TOKEN`, `SSH_SIGNING_KEY`.
- `PNn` (28): `AWS_CONTAINER_AUTHORIZATION_TOKEN`, `ANTHROPIC_IDENTITY_TOKEN`, `CLOUDSDK_AUTH_ACCESS_TOKEN`, `GOOGLE_OAUTH_ACCESS_TOKEN`, `AZURE_CLIENT_CERTIFICATE_PASSWORD`, `AZURE_PASSWORD`, `CLAUDE_CODE_CLIENT_KEY_PASSPHRASE`, `CLAUDE_CODE_CLIENT_KEY`, `CLAUDE_CODE_CLIENT_CERT`, `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`, `https_proxy`, `http_proxy`, `all_proxy`, `CARGO_REGISTRY_TOKEN`, `NPM_TOKEN`, `CODEARTIFACT_AUTH_TOKEN`, `PIP_INDEX_URL`, `PIP_EXTRA_INDEX_URL`, `UV_INDEX_URL`, `UV_EXTRA_INDEX_URL`, `UV_DEFAULT_INDEX`, `UV_INDEX`, `GOPROXY`, `GOAUTH`, `PYPI_TOKEN`, `TWINE_PASSWORD`.
- `ZEe(upper)` (pattern): `NDe(upper)` OR, after stripping one leading `INPUT_` (`n`): `/^GIT_CONFIG_(?:PARAMETERS|(?:KEY|VALUE)_\d+)$/` OR `/^CARGO_REGISTRIES_[A-Z0-9_]+_TOKEN$/` OR `v5t(n)` OR `w5t.test(n)`.
  - `v5t(n)`: with `-`→`_`, has a prefix in `INPUT_|ORG_GRADLE_PROJECT_|POETRY_PYPI_TOKEN_|POETRY_HTTP_BASIC_|CARGO_REGISTRIES_|CONAN_LOGIN_USERNAME_|CONAN_PASSWORD_` (case-insensitive) AND (`^(?:INPUT_)?(?:POETRY_HTTP_BASIC_|CONAN_LOGIN_USERNAME_)` OR `/USER(?:_?NAME)?_?[0-9]*$/i` OR `Fae(n)`).
  - `Fae` is Claude's generic secret-name heuristic (`tn` built from `mn`/`hn`/`Sn`/`En`, camel-case splitter `fn`, `CONN…STR` `hso`, `w5t`, excluding `GIT_CONFIG_KEY_n…` via `Uo`, stripping a leading `AUTH0_`). It is reached only through `v5t` (prefixed names) for MCP.
  - `w5t`: Bundler credentials `^(?:INPUT_)?BUNDLE_<host>__…` excluding `BUNDLE_{BUILD,LOCAL,MIRROR,PATH,WITH,WITHOUT,CACHE,DISABLE,IGNORE,ONLY}__` unless followed by a host form.
- `eRe(upper, value)`: `value !== undefined && FNn.has(upper) && JA(value)`. `FNn` (15 base names, each also `INPUT_`): `ANTHROPIC_BASE_URL`, `_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL`, `ANTHROPIC_BEDROCK_BASE_URL`, `ANTHROPIC_VERTEX_BASE_URL`, `ANTHROPIC_FOUNDRY_BASE_URL`, `ANTHROPIC_AWS_BASE_URL`, `ANTHROPIC_GOOGLE_CLOUD_BASE_URL`, `ANTHROPIC_BEDROCK_MANTLE_BASE_URL`, `CLAUDE_CODE_ARTIFACTS_API_BASE_URL`, `CLAUDE_CODE_ARTIFACT_ASSET_BASE_URL`, `CLAUDE_CODE_ARTIFACT_LIVE_BASE_URL`, `CLAUDE_CODE_ARTIFACT_SYNC_BASE_URL`, `CLAUDE_CODE_ARTIFACT_VIEWER_BASE_URL`, `CLAUDE_CODE_MEMORY_API_BASE_URL`, `CLAUDE_CODE_API_BASE_URL`. The `CLAUDE_CODE_ARTIFACT*` and `CLAUDE_CODE_MEMORY_API_BASE_URL` ones are already `NDe` (always blanked); the value rule only changes the outcome for the `ANTHROPIC_*` ones, `_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL` and `CLAUDE_CODE_API_BASE_URL`.
- `JA(value)` (dump line 412690, self-contained with `He=8192`, `mi`, `sn`, `Si`, `Ei`, `hi`, `kso`, `yi`, `Ri`): see the evidence file. Verbatim port required if mirrored.

### Mode-gated sets: recommend omitting from the snapshot

| Set | Gate | Contents | Recommendation |
|---|---|---|---|
| `Gqe(env)` | `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` truthy (an SDK host embedding Claude) | `ANTHROPIC_CUSTOM_HEADERS`, `MN` (`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, `AWS_BEARER_TOKEN_BEDROCK`, `ANTHROPIC_FOUNDRY_API_KEY`, `ANTHROPIC_FOUNDRY_AUTH_TOKEN`, `ANTHROPIC_AWS_API_KEY`), AWS keys conditionally, empty-valued `eAt` names, the name in `CLAUDE_CODE_HOST_AUTH_ENV_VAR`, `CLAUDE_CODE_HOST_CREDS_FILE` | Omit [ASSUMED: Pi never runs in Claude's host-managed-provider mode] |
| `Voo()` | Claude process is a bridge-carrier child | `CLAUDE_CODE_SESSION_ACCESS_TOKEN`, `SESSION_INGRESS_URL`, `CLAUDE_CODE_BRIDGE_PROMPT_SHA256` | Omit |
| `Gur()` | `il("hipaa")` (organization HIPAA tier) | `gso` = `mso` (14 Anthropic credential names incl. `ANTHROPIC_API_KEY`) + `INPUT_` | Omit |
| `J5t` filter `r(s)` | `ANTHROPIC_UNIX_SOCKET` set and value `"ssh-placeholder"` | removes two names | Snapshot keeps all of `J5t` (superset only in that mode) |
| `tRe(name, value)` | `Bur()`: `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` truthy, or entrypoint `local-agent` | value heuristics (`yso`: build-tool flag vars, `JA`) and, in CI scrub mode, every `Fae` secret-looking name | Omit [ASSUMED]; with `tRe` off none of the 35 variables in the official-marketplace survey is blanked, which matches default Claude |

These omissions are documented divergences under D-04-07's "named sets"; confirm in Open Question 2.

## pi-mcp-adapter 5.1.0: what happens to each written field at connect time

Source read from the 5.1.0 tarball (`utils.ts` lines 138-271, `server-manager.ts` 1155-1190 and 1619-1640, `mcp-auth-flow.ts` 194-320 and 1254-1268, `mcp-auth-fetch.ts` 12-36, `metadata-cache.ts` 109-140), then executed through the real `dist/` build. `interpolateEnvVars` is byte-identical to 5.0.0. [VERIFIED: diff against `~/.cache/pi-cm-phase3-research/rt/node_modules/pi-mcp-adapter/utils.ts` printed `SAME-5.0.0`]

- `interpolateEnvVars(v, env)`: `v.replace(/\$\{(\w+)\}/g, …).replace(/\$env:(\w+)/g, …).replace(/\{env:(\w+)\}/g, …)`, unset → `""`. Each pass re-reads the previous pass's output (so an inserted value is scanned by passes 2 and 3) but never its own. [VERIFIED: utils.ts:138-143 + probe]
- `getMissingEnvVars` matches all three syntaxes on the raw text; `resolveServerUrl` throws `Missing environment variable(s) in MCP server URL: …` for any unset one, before interpolating, then requires `new URL()` to parse. [VERIFIED: utils.ts:145-155, 231-249 + probe]
- `resolveCommandSecret`: `!!x` → `interpolateEnvVars("!x")` (uses `process.env`); a single leading `!` runs `spawnSync(value.slice(1), {shell:true})`; otherwise interpolate. [VERIFIED: utils.ts:187-218]
- `expandHomePath`: `"~"` → `homedir()`; prefix `~/` (and `~\` on win32) → `join(homedir(), rest)`; `~user/x` untouched. Applied **after** interpolation. [VERIFIED: utils.ts:258-271 + probe]
- OAuth: `supportsOAuth` is false whenever `headers` is non-empty and `auth` is unset; this extension never writes `auth` (not in the closed table nor `CARRIED_FIELDS`), so `resolveOAuthHeaders` (which treats an empty-string variable as missing and throws) never sees our header values. [VERIFIED: mcp-auth-flow.ts:1254-1268, adapter-entry.ts:35-45]

### Per-field escape matrix (every field the closed translator writes)

`domain/mcp-server-features.ts` `translateMcpServer` writes exactly: `command`, `args`, `env` (stdio); `url`, `headers`, `httpTransport: "sse"`, `oauth.{clientId, redirectUri, authServerMetadataUrl, scope}`, `requestTimeoutMs` (remote); `description`, `directTools`, `toolPrefix` (all). Carried user fields and the MC-5 marker are not plugin text and are not touched. [VERIFIED: mcp-server-features.ts:60-191, adapter-entry.ts:35-45 read this session]

| Written field | Adapter call chain at connect (5.1.0) | `!` command? | `~` home? | Missing-var refusal? | Claude does | What we write |
|---|---|---|---|---|---|---|
| `command` | `resolveConfigPath` = `expandHomePath(interpolateEnvVars(v))` (server-manager.ts:1155) | no | yes | no | `Y(v)` plain | Claude rule (plain) → serializer; leading `~` blocked upstream (D-04-06) |
| `args[i]` | `expandHomePath(interpolateEnvVars(arg))` (server-manager.ts:1160) | no | yes | no | `Y(v)` plain | same as `command` |
| `env[k]`, `k ∉ {CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA}` | `resolveEnv` → `resolveCommandSecretsRecord` → `resolveCommandSecret` (server-manager.ts:2198) | **yes** | no | no | `Y(v)` plain | Claude rule (plain) → serializer + `!`→`!!` |
| `env.CLAUDE_PLUGIN_ROOT`, `env.CLAUDE_PLUGIN_DATA` (injected or declared) | same as above | **yes** | no | no | not expanded at all (`cLo`) | whole value as literal text → serializer (escapes `${…}` too) + `!`→`!!` |
| `env` keys | not interpolated | — | — | — | not expanded | passthrough |
| `url` | `resolveServerUrl` (refuse missing, interpolate, `new URL`) | no | no | **yes** (`{env:E}` needs `E` set) | `Y(v, true)` remote | Claude rule (remote) → serializer |
| `headers[k]` | `resolveCommandSecretsRecord` (server-manager.ts:1633); `resolveOAuthHeaders` unreachable | **yes** | no | no | `Y(v, true)` remote | Claude rule (remote) → serializer + `!`→`!!` |
| `headers` keys | not interpolated | — | — | — | not expanded | passthrough |
| `oauth.clientId` | `interpolateEnvVars` in `extractOAuthConfig` (mcp-auth-flow.ts:203) | no | no | no | literal | whole value literal → serializer |
| `oauth.scope` (from `scopes`) | `interpolateEnvVars` (mcp-auth-flow.ts:228) | no | no | no | literal | whole value literal → serializer |
| `oauth.authServerMetadataUrl` | `interpolateEnvVars(…).trim()`, must parse as https URL (mcp-auth-flow.ts:297) | no | no | no (but empty after interpolation throws) | literal | whole value literal → serializer |
| `oauth.redirectUri` | `interpolateEnvVars(…).trim()` | no | no | no | (we generate `http://localhost:<int>/callback`) | passthrough (no trigger characters possible) |
| `description` | never interpolated (no call site) | no | no | no | not expanded | passthrough |
| `httpTransport`, `requestTimeoutMs`, `directTools`, `toolPrefix` | constants / numbers | — | — | — | — | passthrough |

Probe results through the real `extractOAuthConfig`: `clientId` `${env:E}{SECRET}` → `${SECRET}`, `scope` `{env:{env:E}SECRET} a` → `{env:SECRET} a`, metadata URL `https://m/$env{env:E}:SECRET` → `https://m/$env:SECRET`. [VERIFIED: Appendix B]

**Survey impact:** the official marketplace (217 servers) uses `oauth.clientId` four times, all plain literals (`claude`, a URL, a numeric id); none contains `$` or `{`. No written value starts with `!` or `~`. So for real plugins the serializer is a no-op except for kept `${VAR}` references. [VERIFIED: survey/out/servers.json analysed this session]

## The serializer (adapter encoding)

### Rules, in order

1. Build segments per value: `text` and `ref(NAME)` (a kept `${NAME}` for the adapter's runtime expansion). Merge adjacent `text` segments **before** escaping (a `:-` default `{env` next to raw `:K}` must be escaped as one run; the probe found `${A:-{env}${R}:K}` leaks without the merge plus guard).
2. Escape each merged text run with one regex pass (inserted text is never re-escaped): `$env:` → `$env{env:E}:`; `{env:` → `{env:{env:E}`; `$` followed by `{\w+}` → `${env:E}` (so `${NAME}` → `${env:E}{NAME}`, covering Claude-literal `${NAME}` and adapter-only `${1X}`).
3. Before each `ref`, if the preceding text run ends with one of `$`, `$e`, `$en`, `$env`, `{`, `{e`, `{en`, `{env`, insert `{env:E}` (boundary guard). Rationale: a kept ref can be `""` at runtime (unset or set-empty), so plugin text on both sides could otherwise compose `$env:NAME` or `{env:NAME}` in passes 2/3.
4. For `env` and `headers` values: if the final string starts with `!`, prefix one `!` (D-04-03). (`!!!x` → adapter `!!x`, verified.)
5. Never emit a resolved environment value: a `ref` is always the literal `${NAME}`; values are only used for decisions (set/unset, value rule).

### Verified outputs (real 5.1.0 `interpolateEnvVars`, `E=""`)

| Claude output wanted | Written | Adapter output |
|---|---|---|
| `{env:SECRET}` | `{env:{env:E}SECRET}` | `{env:SECRET}` |
| `$env:SECRET` | `$env{env:E}:SECRET` | `$env:SECRET` |
| `${SECRET}` (Claude literal) | `${env:E}{SECRET}` | `${SECRET}` |
| `${1X}` (adapter-only form) | `${env:E}{1X}` | `${1X}` |
| `{env:` + runtime `X` + `}` | `{env:{env:E}${X}}` | `{env:VALX}` |
| `{env:{env:SECRET}}` | `{env:{env:E}{env:{env:E}SECRET}}` | `{env:{env:SECRET}}` |

(`E` abbreviates `PI_CLAUDE_MARKETPLACE_EMPTY` in this table; the probe used the full name.)

### Residual the serializer cannot close

A runtime value that itself contains a full `$env:NAME` or `{env:NAME}` is expanded again by passes 2/3 (probe: `$${ENVX}` with `ENVX="env:SECRET"` → the secret). The value comes from the user's environment, so this is self-inflicted, except for `CLAUDE_PROJECT_DIR` (D-04-09), whose value is the session cwd, a directory name. See Threat T4.

## Reserved variable `E` and `CLAUDE_PROJECT_DIR`: ordering

### Facts

- Pi 1.0 loads extensions sequentially (`for (const extPath of paths) await loadExtension(...)`, `loader.js:545-566`), awaits each factory, and emits every event to handlers in extension load order, then registration order, each awaited (`runner.js:87-89`, `807-830`). [VERIFIED: installed `@earendil-works/pi-coding-agent` 1.0.0 dist]
- Load order follows the configured package/path list; this extension cannot guarantee it loads before pi-mcp-adapter. [ASSUMED: no Pi API to order extensions]
- The adapter connects servers in three places: (a) `startLoadTimeInitialization()` via `setImmediate` right after its own factory, only when a non-disabled, non-project server has `lifecycle` `eager` or `keep-alive` (`index.ts:379-380`, `1274-1292`, `2345`); (b) its `session_start` handler, which re-initializes and connects every `eager`/`keep-alive` server **and every lazy server whose metadata cache is missing or stale** (`needsDiscovery`, `init.ts:343-347`), which is the normal state right after an install plus `/reload`; (c) first use. [VERIFIED: adapter 5.1.0 source]
- `lifecycle` is in `CARRIED_FIELDS`, so a user's `/mcp-adapter` override can make our entry `eager`. [VERIFIED: adapter-entry.ts:35-45]
- Our `session_start` runs after the adapter's whenever the adapter loads first, and Pi awaits the adapter's handler (including `await initializationStarted`) before ours.
- `process.env` survives `/reload` (module top level re-evaluates, the process does not). [CITED: shared/session-env.ts header]
- Hooks: `prepareHookEnv` spreads `process.env` then sets `CLAUDE_PROJECT_DIR: transCtx.cwd`, so the per-dispatch value always wins over a process-level one; `claudeSessionEnvFor` (shared by both hook lanes) must not gain the key. [VERIFIED: bridges/hooks/hook-env.ts:61-70: `...process.env,` then `CLAUDE_PROJECT_DIR: transCtx.cwd,`]

### Recommendation

- **Name:** `PI_CLAUDE_MARKETPLACE_EMPTY`. It matches `\w+`, follows the existing `PI_CLAUDE_MARKETPLACE_PATH` / `PI_CLAUDE_MARKETPLACE_DEBUG` convention, cannot collide with a plugin's variable in practice, and is not matched by any deny-list predicate. Its length only appears in entries that need a split token (none of the 217 surveyed servers). Export it as a constant from `shared/session-env.ts` next to `PATH_LEDGER_ENV`; the bridge imports it from `shared/` (allowed zone edge).
- **Set point:** a new `applyMcpAdapterEnv(cwd: string): void` in `shared/session-env.ts` that assigns `process.env.PI_CLAUDE_MARKETPLACE_EMPTY = ""` and `process.env.CLAUDE_PROJECT_DIR = cwd`. Call it as the **first statement of the factory** with `process.cwd()` (covers the adapter's `session_start` connect when the adapter loads first), and again inside the existing `session_start` handler with `ctx.cwd` (refresh; keep `applySessionEnv` exactly three keys, since its test pins that). Wrap the `session_start` call so a throw cannot escape (NFR-2), and keep it outside the try that evaluates `ctx.sessionManager.getSessionId()`. Do not register a second `session_start` handler: `tests/index.test.ts` consumes the `session_start` expectations in declaration order.
- **Residual window:** the adapter's load-time `setImmediate` can fire while Pi is still importing this extension, only for a user-scope entry made `eager`/`keep-alive` by a user override, and only on the first load in a process. A `url` split token then fails once with `Missing environment variable in MCP server URL: PI_CLAUDE_MARKETPLACE_EMPTY`; the adapter's own `session_start` re-initializes (it stops the previous owner) after our factory has run, so the server connects in that same session. No credential exposure: with `E` unset, `{env:E}` in other fields interpolates to `""`, the same as set-empty. Document it; no code can close it.
- **MENV-03:** drop the explicit `CLAUDE_PROJECT_DIR` injection into project-scope stdio `env`. D-04-01 fixes the injected set at `{CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA}`, Claude injects only those two, and D-04-09 makes the variable reach every child by inheritance (`inheritEnv` defaults true). This changes entry content for project-scope stdio servers; fine because Phases 2-5 ship in one release.
- **User-scope `${CLAUDE_PROJECT_DIR}` in the tokenizer:** treat the exact token as a kept `ref` that is never reported missing (its runtime value is guaranteed by the set point). `${CLAUDE_PROJECT_DIR:-x}` follows the ordinary rule (it is set in Pi's process, so `${CLAUDE_PROJECT_DIR}` is written; Claude's main process does not have it set, so Claude would use `x`: negligible divergence, document).

## Where each change lands

| Change | File(s) | Notes / complexity |
|---|---|---|
| Deny-list snapshot | NEW `extensions/pi-claude-marketplace/domain/claude-credential-denylist.ts` | `CLAUDE_CODE_DENYLIST_VERSION = "2.1.291"`; frozen uppercase `ReadonlySet`s; `isPlainDenied(upper)`, `isRemoteSinkDenied(upper, value)`. `JA`/`Fae` verbatim regexes will trip `sonarjs/regex-complexity` and possibly `sonarjs/slow-regex` (both `error` in the recommended preset): each needs `// eslint-disable-next-line sonarjs/regex-complexity -- verbatim Claude Code 2.1.291 …`. Split predicates into small functions (≤15 cognitive). |
| Claude rule port | NEW `domain/claude-mcp-variables.ts` | `expandClaudeValue(raw, fieldClass, env, ctx)` → `{segments, missing, blanked}`; `scanServerVariables(rawServer, scope, env)` for info and for the bridge's field walk. Env is a parameter (`Readonly<Record<string, string | undefined>>`), never `process.env` inside. |
| Adapter serializer | NEW `bridges/mcp/adapter-escape.ts` | `serializeForAdapter(segments, { secret })`; owns the split-token constants built from the shared `E` name. |
| Five-field narrowing + injection | `bridges/mcp/substitute.ts` (rewrite `substituteAndInject`, retire `VAR_RE` deep walk) | Return the expanded entry plus a per-server report `{missing: string[], blanked: string[]}` (blanked = remote, set). Keep `safeSet` for key copies. |
| Order of operations | `bridges/mcp/adapter-entry.ts` `translatedEntry` | Translate first with the closed table (Claude does not expand `oauth`, and `oauthField`'s `https://` check runs on raw text as Claude's schema does), then inject env for stdio, then expand per the matrix. `stampServers` returns `{stamped, warnings, variableReports}`. |
| Notices | `shared/notification-dispatch.ts` (`McpConfigNotice` union + `notifyMcpConfigNotices`), `bridges/mcp/stage.ts` (build notices from `variableReports`) | Two new kinds, e.g. `variables-missing` and `credentials-blanked`, each `{scope, file:"mcp-adapter.json", plugin, server, names}`. Every staging path already forwards `StageMcpCommitResult.notices` (install-flow, install-cascade, enable-disable, update-swap/update-flow, reinstall-flow/replace, import/execute, reconcile apply via `carriedMcpConfigNotices`). Phase 5 migration must stage through the same path. [VERIFIED: grep of consumers this session] |
| `~` arm (D-04-06) | `domain/mcp-server-features.ts` (`McpUnsupportedFeature` + `classifyStdio`), `domain/resolver-types.ts` (`DroppedMcpServerSchema` union, type-level drift check forces it) | New literals, e.g. `"command ~"` and `"args ~"`, render through the existing `(unsupported <feature>)` grammar (`notification-grammar.ts:1389-1391`). No new `Reason`, so `compat-01` and `notify-closed-set-locks` are untouched. |
| info lines (D-04-11) | `orchestrators/plugin/info.ts` (`composeMcpEntries`, resolved arm only), `shared/notification-types.ts` (`McpServerSummaryEntry` gains optional name lists), `shared/notification-grammar.ts` (`appendMcpLine`) | Thread an injected `env` through the info dependencies (default `process.env` at the edge) so catalog fixtures stay deterministic. The state-only arm has no raw configs: show nothing there (document). |
| Env set point | `shared/session-env.ts`, `index.ts` | See ordering section. |
| Catalog | `docs/output-catalog.md` | (a) the `{unsupported mcp}` feature list prose (~line 725) gains the `~` features; (b) new notice blocks for the two kinds, locked byte-for-byte in `tests/architecture/mcp-config-notices.test.ts` `CATALOG_NOTICE_ROWS`; (c) a new info catalog state with the variable lines (plus a fixture in `tests/architecture/catalog-uat/fixtures/plugin-info.ts`). `catalog-contract.test.ts` pins `EXPECTED_STATE_COUNT = 265` and `EXPECTED_UTF8_BYTES = 40_571`: bump both in the same change. [VERIFIED: tests/architecture/catalog-uat/catalog-contract.test.ts:39-40] |
| Backlog | `.planning/BACKLOG.md` | Close MENVX-01 (`!!`) and ENVLIT-01 (`literalEnv` evaluated, not used); ENVDOC-01 stays for Phase 7. |

Module-size guidance: today's `substitute.ts` is 122 lines and `adapter-entry.ts` 237; the new logic (tokenizer ~120, serializer ~60, snapshot ~250 with data) must not be folded into them or fallow/sonarjs complexity limits will bite. Each new source needs a paired test with 100% direct line/branch/function coverage (JA's `r` closure, `sn`, `mi` branches need explicit cases).

## Official-marketplace survey implications (fixtures)

Re-analysed `survey/out/servers.json` (315 plugins, 217 servers; types: 70 none, 132 `http`, 6 `streamable-http`, 7 `stdio`, 1 `sse`, 1 `url`). [VERIFIED: analysis script this session]

- 35 distinct `${NAME}` variables: `CLAUDE_PLUGIN_ROOT` 21× (19 args, 2 command); url: `DEVOPS_AGENT_REGION`, `DD_MCP_DOMAIN`, `JFROG_URL`, `LOGFIRE_MCP_URL`, `SOURCEGRAPH_ENDPOINT`, `DT_ENVIRONMENT`; headers: 18 token names (e.g. `DD_API_KEY`, `GITHUB_PERSONAL_ACCESS_TOKEN`, `ZOOM_*_MCP_ACCESS_TOKEN`); env: 9 (`COCKROACHDB_*`, `DOMINO_*`, `PINECONE_API_KEY`); args: `TFE_TOKEN`.
- `${VAR:-default}` 6×: `${DEVOPS_AGENT_REGION:-us-east-1}` (url), `${DD_MCP_DOMAIN:-not-setup}` (url), `${DD_API_KEY:-}`, `${DD_APPLICATION_KEY:-}`, `${DD_MCP_TOOLSETS:-}` (headers), `${LOGFIRE_MCP_URL:-https://logfire-us.pydantic.dev/mcp}` (url).
- **No surveyed variable is on either deny-list** (none is in a literal set, `NDe`, or `ZEe`; `GITHUB_PERSONAL_ACCESS_TOKEN` and `DD_API_KEY` are not covered). So the deny-list never changes a real official server's output; the security test must use synthetic fixtures (`ANTHROPIC_API_KEY`, `AWS_SESSION_TOKEN`, `OTEL_EXPORTER_OTLP_HEADERS`, `INPUT_NPM_TOKEN`, `GIT_CONFIG_VALUE_0`, `CARGO_REGISTRIES_MY_TOKEN`, a credential-bearing `ANTHROPIC_BASE_URL`).
- No `$env:`, `{env:`, leading `~`, leading `!`, bare `$NAME` or `${digit…}` anywhere. Fixtures for those are synthetic.
- Recommended real fixtures: datadog headers `${DD_API_KEY:-}` (set → `${DD_API_KEY}`; unset → `""`, not missing), logfire url default (unset → the default URL text; set → `${LOGFIRE_MCP_URL}`), a `${CLAUDE_PLUGIN_ROOT}` args server, one unset-no-default header token (missing warning).

## Threat model inputs (ASVS L1, block on high)

| ID | Threat | STRIDE | Route | Mitigation | Proof |
|---|---|---|---|---|---|
| T1 | Secret written to disk | Information disclosure | Resolving `${VAR}` at install | Only `:-` default text (plugin-authored) and builtin paths are resolved; set variables stay `${VAR}`; deny-listed set ones become `""` | Sentinel test: every referenced variable set to a unique sentinel; written JSON contains none (unit + stage integration) |
| T2 | Deny-list bypass through adapter-only syntax | Information disclosure | `{env:ANTHROPIC_API_KEY}` / `$env:…` in url/headers | Split-token literal escaping (D-04-04) | Conformance: adapter output equals Claude's literal |
| T3 | **Deny-list bypass by kept-reference spacer** (NEW) | Information disclosure | `{env${UNSET}:ANTHROPIC_API_KEY}` in a header; runtime `""` composes `{env:…}` | Boundary guard before kept refs + merge-before-escape | Bounded-exhaustive conformance (0 vs 102 mismatches) |
| T4 | Deny-list bypass by runtime value re-scan | Information disclosure | A kept ref whose value contains `{env:X}`/`$env:X`; notably `CLAUDE_PROJECT_DIR` = cwd at user scope | Cannot be escaped at install. Option: `applyMcpAdapterEnv` skips exporting `CLAUDE_PROJECT_DIR` (and debug-logs) when the cwd contains `$env:` or `{env:` (Open Question 4). GitHub repo names cannot contain `{`, `:` or `$` | Unit test on the guard if adopted; residual documented |
| T5 | Shell execution | Elevation of privilege | A written `env`/`headers` value starting with a single `!` | `!`→`!!`; only `env` and `headers` reach `resolveCommandSecret`; `bearerToken`, `oauth.clientSecret`, `requestHeadersCommand` are never written | Invariant test: every written env/header value starts with `!!` or not with `!`; conformance never feeds a single `!` |
| T6 | Path tampering via home expansion | Tampering | Leading `~` in command/args | Resolver `{unsupported mcp}` partial (D-04-06) | Resolver + install refusal tests |
| T7 | Availability | Denial of service | `E` unset → url refused; adapter loads first with eager override | Set in factory and `session_start` | index/session-env tests; residual documented |
| T8 | Split-token construction breaks on an adapter change | Tampering / disclosure | Adapter changes pass order, makes passes recursive, adds a syntax, changes `\w` (e.g. Unicode), or adds a literal mode; optional peer range `>=5.1.0` admits all future majors | Conformance test pinned to the floor and run in CI; drift guard asserting the call-site strings in `dist/server-manager.js` (`expandHomePath(interpolateEnvVars(argument))`, `resolveConfigPath(definition.command)`, `resolveCommandSecretsRecord(env`, `resolveCommandSecretsRecord(definition.headers`) and `interpolateEnvVars` source text; consider an upper bound `<6` (Open Question 5) | Conformance run records adapter version |
| T9 | Credential value in output | Information disclosure | Notices or info printing values | Names only (D-04-10/11) | Test: no sentinel in notify/info output |
| T10 | Reserved variable tampering | Tampering | User sets `E` non-empty | Overwritten to `""` at every load; a non-empty `E` only corrupts literal text (inserted once, not re-scanned), never expands a secret | Probe reasoning; unit test optional |

ASVS L1 mapping: V5.3.8 (OS command injection) → T5; V5.2/V5.3 output encoding for a downstream interpreter → T2/T3; V8.3.1/V8.3.4 (sensitive data not persisted) → T1; V7.1.1 (no credentials in logs) → T9; V14.2 (dependency pinning) → T8. [ASSUMED: ASVS 4.0.3 numbering]

## Architecture Patterns

### Data flow

```
plugin server (raw, from resolver)
   │  classifyMcpServer (domain): ~ in command/args → blocked → {unsupported mcp}, partial
   ▼
translateMcpServer (domain closed table)  → only Claude-read fields, adapter names
   ▼
inject stdio env {CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA, ...declared}
   ▼
per written field ─► field class (plain | remote | literal | passthrough)
   ▼
expandClaudeValue (domain): Ase builtins → oq rule with deny-list snapshot + install env
   │      └─► missing[], blanked[]  ──► variableReports ──► stage notices ──► notifyMcpConfigNotices
   ▼
segments [text | ref]
   ▼
serializeForAdapter (bridge): merge text → escape triggers → guard before refs → !→!! (env/headers)
   ▼
stamped entry + carried fields + MC-5 marker → mcp-adapter.json
   ▼  (runtime, adapter)
interpolateEnvVars ×3 passes with E="" and the user's env → Claude's output
```

### Pattern: Claude tokenizer (sketch)

```typescript
// domain/claude-mcp-variables.ts (sketch; names are proposals)
export type FieldClass = "plain" | "remote";
export type Segment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "ref"; readonly name: string };

// Claude Code 2.1.291 `oq` grammar, verbatim.
const CLAUDE_VARIABLE = /\$\{([A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?)\}/g;

function decide(name: string, fallback: string | undefined, fieldClass: FieldClass,
                env: Readonly<Record<string, string | undefined>>, report: Report): Segment {
  const value = env[name];
  const denied = fieldClass === "remote"
    ? isRemoteSinkDenied(name.toUpperCase(), value)
    : isPlainDenied(name.toUpperCase());
  if (denied && (value !== undefined || fieldClass === "remote")) {
    if (value !== undefined) report.blanked.push(name);
    return { kind: "text", text: "" };
  }
  if (value !== undefined) return { kind: "ref", name };            // AVAR-02: keep ${VAR}
  if (fallback !== undefined) return { kind: "text", text: fallback };
  report.missing.push(name);
  return denied ? { kind: "text", text: `\${${name}}` }            // literal, never expanded later
                : { kind: "ref", name };                            // left for the adapter
}
```

### Pattern: adapter serializer (sketch, verified by the probe)

```typescript
// bridges/mcp/adapter-escape.ts (sketch)
const SPLIT = `{env:${ADAPTER_EMPTY_ENV}}`;
const TRIGGER = /\$env:|\{env:|\$(?=\{\w+\})/g;
const PARTIAL_TRIGGER_TAIL = /(?:\$(?:e(?:nv?)?)?|\{(?:e(?:nv?)?)?)$/;

function escapeText(text: string): string {
  return text.replace(TRIGGER, (m) =>
    m === "$env:" ? `$env${SPLIT}:` : m === "{env:" ? `{env:${SPLIT}` : `$${SPLIT}`);
}

export function serializeForAdapter(segments: readonly Segment[], secret: boolean): string {
  let out = "";
  let previousText = "";
  for (const segment of mergeText(segments)) {
    if (segment.kind === "text") {
      out += escapeText(segment.text);
      previousText = segment.text;
    } else {
      if (PARTIAL_TRIGGER_TAIL.test(previousText)) out += SPLIT;
      out += `\${${segment.name}}`;
      previousText = "";
    }
  }
  return secret && out.startsWith("!") ? `!${out}` : out;
}
```

### Anti-patterns

- **Escaping each segment separately:** a `:-` default and the raw text next to it form one literal for the adapter; escape merged runs only.
- **Re-escaping inserted split tokens:** do the trigger replacement in one regex pass.
- **Reading `process.env` inside domain functions:** inject the env map; tests then never touch real values.
- **Deep-walking the whole entry (today's `deepSubstitute`):** expands fields Claude leaves alone (`oauth`, `description`).
- **Using `literalEnv: true`:** disables runtime `${VAR}` in `env`, which Claude needs.
- **Adding `CLAUDE_PROJECT_DIR` to `claudeSessionEnvFor`:** it would override the hooks' per-dispatch value order guarantees and break its pinned triple.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| The deny-list | A "reasonable" list of secret-looking names | The verbatim 2.1.291 sets + predicates (`04-EVIDENCE-claude-2.1.291.txt`) | Parity is the product; `GITHUB_TOKEN` is deliberately absent, `ANTHROPIC_API_KEY` is remote-only |
| `JA` credential-in-value heuristic | A simplified `user:pass@` check | Verbatim port (with lint suppressions) or the Open Question 1 alternative | The docs promise the exact behavior |
| Adapter behavior in tests | A re-typed `interpolateEnvVars` | The installed adapter's `dist/utils.js` via `PI_MCP_ADAPTER_ROOT` | ROADMAP note: build the matrix from the real functions |
| Expansion rule | A new grammar | Claude's `oq` regex verbatim | It is the whole contract |

## Common Pitfalls

1. **Spacer composition (T3):** without the guard, `{env${R}:K}` leaks `K` through a header. Warning sign: any change to the serializer without the bounded-exhaustive test.
2. **Merging after escaping:** escape per segment and `${A:-{env}${R}:K}` leaks. Merge first.
3. **`E` unset in url:** refusal `Missing environment variable in MCP server URL: PI_CLAUDE_MARKETPLACE_EMPTY`. Set it in the factory, not only in `session_start`.
4. **Single `!` in tests:** `resolveCommandSecret` spawns a shell. The conformance harness must refuse a value starting with a single `!` before calling it, and set variables only through an explicit env.
5. **Mutating `process.env` in tests:** `resolveCommandSecret` and `extractOAuthConfig` read `process.env`. In the conformance file, set and restore in `t.after`, or run the cases in a child `node` with an explicit env. Never in architecture gates (`compat-01` forbids it).
6. **Stale global adapter:** the local global `pi-mcp-adapter` is 2.6.1. A harness that falls back to `npm root -g` would silently skip below the floor; use `PI_MCP_ADAPTER_ROOT` only.
7. **Case handling:** membership uses the uppercased name, value lookup the exact name. `${anthropic_api_key}` in a header is blanked.
8. **Remote default ignored:** `${ANTHROPIC_API_KEY:-x}` in a header is `""`, not `x`.
9. **cLo keys:** a declared `env.CLAUDE_PLUGIN_ROOT: "${FOO}"` is literal in Claude and must be written `${env:E}{FOO}`.
10. **Catalog counts:** new catalog states bump `EXPECTED_STATE_COUNT`/`EXPECTED_UTF8_BYTES` in `catalog-contract.test.ts`, and new notice blocks need rows in `mcp-config-notices.test.ts`.
11. **sonarjs regex rules:** verbatim `JA`/`Fae` regexes need justified per-line disables; `no-await-in-loop` irrelevant here.
12. **Runtime-unset divergence (document, not a bug):** a kept `${VAR}` unset at runtime becomes `""` in the adapter (url: server refused) where Claude would show the literal `${VAR}` and warn.

## Code Examples

### Probe that verified the escape scheme (reuse in the conformance test)

```javascript
// Source: written and run this session against pi-mcp-adapter 5.1.0 dist/utils.js
import { pathToFileURL } from "node:url";
const u = await import(pathToFileURL(`${process.env.PI_MCP_ADAPTER_ROOT}/dist/utils.js`).href);
const E = "PI_CLAUDE_MARKETPLACE_EMPTY";
u.interpolateEnvVars(`{env:{env:${E}}SECRET}`, { [E]: "", SECRET: "S" });   // "{env:SECRET}"
u.resolveServerUrl({ url: `https://h/{env:{env:${E}}SECRET}` }, { SECRET: "S" });
// throws "Missing environment variable in MCP server URL: PI_CLAUDE_MARKETPLACE_EMPTY"
u.expandHomePath(u.interpolateEnvVars(`{env:${E}}~/x`, { [E]: "" }));       // "<home>/x"
```

### Conformance harness shape (mirrors `tests/integration/pi-subagents-peer.ts`)

```typescript
// tests/integration/pi-mcp-adapter-peer.ts (proposal)
// PI_MCP_ADAPTER_ROOT names an installed pi-mcp-adapter package directory.
// Unset → the test skips. Set but not pi-mcp-adapter (or no package.json) → fail.
// Below the declared peer floor → skip with the version as a diagnostic.
// No `npm root -g` fallback: the local global is a stale 2.6.1.
export async function loadAdapterModule(root: string, module: "utils" | "mcp-auth-flow"): Promise<unknown> {
  return import(pathToFileURL(path.join(root, "dist", `${module}.js`)).href);
}
```

Consider generalizing `pi-subagents-peer.ts` into one optional-peer helper parameterized by package name and env var, rather than a near-copy (fallow dupes).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Whole-entry deep walk of three builtins (`substitute.ts` `VAR_RE`, MENV-01) | Five-field Claude rule with deny-list and adapter encoding | This phase | `oauth`/`description` stop being substituted; written entries change shape (hash change, same release) |
| Explicit `CLAUDE_PROJECT_DIR` injection into project stdio env (MENV-03) | Process-level `CLAUDE_PROJECT_DIR` (D-04-09), injected set `{ROOT, DATA}` | This phase | Matches Claude's injected set |
| pi-mcp-adapter `resolveEnv` interpolation (≤2.21) | `resolveCommandSecret` with `!` commands (≥2.31; still in 5.1.0) | upstream | `!!` escape required (MENVX-01) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `D(S)` in `uLo` is a uniq helper preserving first-seen order | Warnings | Missing-name order/dedup in our notice differs cosmetically |
| A2 | Pi never runs in Claude's host-managed-provider, bridge-child, HIPAA or scrub modes, so `Gqe`/`Voo`/`Gur`/`tRe` can be omitted | Deny-list | A user with `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` exported would see fewer names blanked than in Claude |
| A3 | Extension load order cannot be controlled by an extension | Ordering | If it can, `E` could be set before the adapter loads and the residual window closes |
| A4 | Pi keeps one cwd per process across `/new`/`/resume` (factory `process.cwd()` equals `ctx.cwd`) | Ordering | If a session switch changes cwd, the adapter (loaded first) may connect once with the previous project dir |
| A5 | ASVS 4.0.3 section numbers | Threat model | Labels only |
| A6 | The adapter's `session_start` re-initialization supersedes a failed load-time connect in the same session | Ordering residual | The eager server stays failed until `/mcp-adapter reconnect` |

## Open Questions (for the operator before planning locks)

1. **`*_BASE_URL` value rule: port `JA` or simplify?** D-04-07 says mirror and evaluate at install. With `JA` ported, a set credential-free `ANTHROPIC_BASE_URL` is written `${ANTHROPIC_BASE_URL}` (kept), and a later credential-bearing value would then reach the server through the adapter. Alternative: always blank the 15 `FNn` names in url/headers (no port, closes that residual, diverges from the documented `"${ANTHROPIC_BASE_URL}/mcp"` example). Recommendation: port `JA` verbatim (parity, documented example) and record the residual.
2. **Mode-gated sets omitted?** Recommendation: omit `Gqe`, `Voo`, `Gur`, `tRe`; keep all of `J5t`. Documented divergence.
3. **Static `~` detection scope (D-04-06):** block only a raw leading `~` (`~`, `~/`, `~\`), or also a leading `${VAR:-~…}` default (env-dependent at install; the resolver is env-free)? Recommendation: block both statically and conservatively (no surveyed plugin is affected), including `~\` regardless of platform.
4. **`CLAUDE_PROJECT_DIR` guard (T4):** skip exporting it when the cwd contains `$env:` or `{env:`? Recommendation: yes, with a debug-log line; it is a project-decision divergence affecting only pathological directory names.
5. **Adapter peer upper bound:** keep `>=5.1.0` or add `<6`? The split tokens depend on adapter internals and 5 releases shipped in 8 days. Recommendation: keep `>=5.1.0` (PIFL-03 just landed) but run the conformance test in CI and in the release checklist; revisit if a major changes `utils.ts`.
6. **CI:** add the scratch-install step to the `integration` job? Recommendation: yes (see Validation Architecture); this is a security control and the pi-subagents precedent is a recorded CI gap.
7. **D-04-11 "blanked" rule in info:** list remote-field deny-listed references always, plus plain-field ones that are set now? (On disk a plain-field one is `""` only if it was set at install.) Recommendation: yes, and word the line as "blanked" for remote and "blanked when set" semantics documented.
8. **Notice and info wording:** catalog text for the two new notice kinds and the info line is the planner's draft for operator review.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | ✓ | v26.10.0 local, 24 in CI | — |
| npm | scratch install | ✓ | 11.19.1 | — |
| pi-mcp-adapter scratch install | conformance test | ✓ (installed this session at `/var/tmp/pi-cm-p4-adapter`) | 5.1.0 | Test skips without `PI_MCP_ADAPTER_ROOT` |
| Global pi-mcp-adapter | — | stale | 2.6.1 | Do not use |
| Claude Code binary | evidence only | ✓ | 2.1.291 (path-derived) | Evidence file in phase dir |
| Network (npm registry) | scratch install in CI | ✓ in CI (e2e already uses network) | — | — |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 24 CI) |
| Config file | none (scripts in package.json) |
| Quick run command | `node --test <test-file>` |
| Full suite command | `npm run check` |
| Conformance command | `PI_MCP_ADAPTER_ROOT=/var/tmp/pi-mcp-adapter-5.1.0/node_modules/pi-mcp-adapter node --test --test-reporter=./scripts/test-reporter.mjs tests/integration/adapter-expansion-conformance.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AVAR-01 | Builtins expanded only in the five fields; `cLo` keys literal; oauth/description untouched; injected set `{ROOT, DATA}` | unit | `node --test tests/bridges/mcp/substitute.test.ts tests/bridges/mcp/adapter-entry.test.ts` | ✅ rewrite |
| AVAR-02 | `:-` rule table; set→`${VAR}`; no sentinel value in written entry | unit + stage | `node --test tests/domain/claude-mcp-variables.test.ts tests/bridges/mcp/stage.test.ts` | ❌ new / ✅ extend |
| AVAR-03 | Serializer goldens; guard; `!!`; `~` → blocked verdict and partial install | unit | `node --test tests/bridges/mcp/adapter-escape.test.ts tests/domain/mcp-server-features.test.ts tests/domain/plugin-resolver.test.ts` | ❌ / ✅ / ✅ |
| AVAR-03 | Every case through the real adapter (incl. url `E` set/unset, `!!` via `resolveCommandSecret`, oauth via `extractOAuthConfig`, bounded-exhaustive property), drift guard on `dist/server-manager.js` call sites | integration | conformance command above; `npm run test:integration` | ❌ new |
| AVAR-04 | Missing names per server, order, dedup; notice kinds rendered byte-equal to catalog; every staging path forwards them | unit + arch | `node --test tests/shared/notification-dispatch.test.ts tests/architecture/mcp-config-notices.test.ts` + orchestrator tests for install/update/reinstall/enable/import/reconcile | ✅ extend |
| AVAR-04 | info shows unset/blanked names from injected env | unit + catalog | `node --test tests/orchestrators/plugin/info.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | ✅ extend |
| AVAR-05 | Snapshot pinned (version string, exact enumerated sets, predicate cases incl. `INPUT_`, case, `MNn` exclusions, `JA` cases); security test: deny-listed credential never in url/headers output (written and through adapter) | unit + integration | `node --test tests/domain/claude-credential-denylist.test.ts` + conformance | ❌ new |
| D-04-05/09 | Factory sets `E=""` and `CLAUDE_PROJECT_DIR`; `session_start` refreshes; hooks per-dispatch value wins | unit | `node --test tests/shared/session-env.test.ts tests/index.test.ts` | ✅ extend |

### Sampling Rate

- **Per task commit:** the owner tests above (`node --test <file>`); the hook runs `check:commit`.
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` green plus one recorded zero-skip conformance run: command, `# skipped 0`, adapter version 5.1.0, Node version, commit; and a negative run with `PI_MCP_ADAPTER_ROOT=/nonexistent` that fails.

### Wave 0 Gaps

- [ ] `tests/integration/pi-mcp-adapter-peer.ts` (or a generalized optional-peer helper) — env-var-only lookup, floor from `package.json`.
- [ ] `tests/integration/adapter-expansion-conformance.test.ts` — case table + bounded-exhaustive property + call-site drift guard.
- [ ] Shared case table module under `tests/` (e.g. `tests/bridges/mcp/expansion-cases.ts`) consumed by the unit test (written == golden) and the conformance test (adapter(written) == Claude output). A non-test file under `tests/` makes `check:commit` run all pairs.
- [ ] `tests/domain/claude-credential-denylist.test.ts`, `tests/domain/claude-mcp-variables.test.ts`, `tests/bridges/mcp/adapter-escape.test.ts` (paired, 100% direct coverage).
- [ ] CI: in `.github/workflows/ci.yml` `integration` job, before `npm run test:integration`: `npm install --prefix "$RUNNER_TEMP/pi-mcp-adapter" pi-mcp-adapter@5.1.0 --ignore-scripts --omit=peer --no-audit --no-fund` and `PI_MCP_ADAPTER_ROOT: ${{ runner.temp }}/pi-mcp-adapter/node_modules/pi-mcp-adapter` in the test step env (zizmor-clean: pinned version, no expression interpolation in `run`).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Validation, Sanitization and Encoding | yes | Claude grammar port + adapter output encoding (split tokens, guard, `!!`); typebox schemas already validate shapes |
| V6 Cryptography | no | — |
| V7 Error Handling and Logging | yes | Notices and info print variable names only |
| V8 Data Protection | yes | No environment value persisted; deny-list snapshot |
| V14 Configuration | yes | Optional peer floor, conformance pinned to floor |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Second-order template expansion (adapter re-expands our output) | Tampering / Disclosure | Encode for the downstream interpreter; prove with the real interpreter (conformance) |
| Shell command marker in config values | Elevation | Escape marker (`!!`) on every field that reaches the command path |
| Credential exfiltration to a remote MCP server | Disclosure | Deny-list blanking computed at install, never deferred |

## Sources

### Primary (HIGH confidence)
- Claude Code 2.1.291 binary, `strings -a` dump: `uLo`, `Ase`, `oq`, `U4`, `ZEe`, `eRe`, `tRe`, `qur`, `NDe`, `J5t`, `mqe`, `No`, `PNn`, `MNn`, `ON`, `JA`, `Fae`, `v5t`, `w5t`, `Gqe`, `Voo`, `Gur`, `Bur`, logger `t` — verbatim in `04-EVIDENCE-claude-2.1.291.txt`.
- pi-mcp-adapter 5.1.0 tarball and `npm install` (this session): `utils.ts`, `server-manager.ts`, `mcp-auth-flow.ts`, `mcp-auth-fetch.ts`, `metadata-cache.ts`, `config.ts`, `types.ts`, `index.ts`, `init.ts`, `docs/servers.md:105`; real `dist/` functions executed.
- `@earendil-works/pi-coding-agent` 1.0.0 installed dist: `core/extensions/loader.js`, `runner.js`, `types.d.ts`.
- Repository source read this session: `bridges/mcp/{substitute,adapter-entry,stage}.ts`, `domain/{mcp-server-features,resolver-types,mcp-resolution}.ts`, `shared/{session-env,notification-dispatch,notification-types,notification-grammar}.ts`, `index.ts`, `orchestrators/plugin/info.ts`, `package.json`, `.fallowrc.json`, architecture gates.

### Secondary (MEDIUM-HIGH)
- https://code.claude.com/docs/en/mcp — "Environment Variable Expansion in .mcp.json", "Credential Variables That Read As Empty", plugin path placeholders (fetched 2026-10-07).
- Official-marketplace survey data (`anthropics/claude-plugins-official` at `d4226d06`), re-analysed this session.

### Tertiary (LOW)
- none relied on.

## Metadata

**Confidence breakdown:**
- Claude rule and lists: HIGH (verbatim binary + docs agree).
- Adapter matrix and escape scheme: HIGH (real functions, 462,790-case probe).
- Ordering/residual window: MEDIUM-HIGH (source-read, not run live in Pi).
- Module layout and wording: MEDIUM (recommendations).

**Research date:** 2026-10-07
**Valid until:** the next Claude Code or pi-mcp-adapter release (fast-moving: re-run the evidence extraction and the conformance test on either bump).

## Appendix B: probe outputs (pi-mcp-adapter 5.1.0, `E=PI_CLAUDE_MARKETPLACE_EMPTY`)

```text
{env:SECRET} literal               "{env:{env:PI_CLAUDE_MARKETPLACE_EMPTY}SECRET}"              -> "{env:SECRET}"
$env:SECRET literal                "$env{env:PI_CLAUDE_MARKETPLACE_EMPTY}:SECRET"               -> "$env:SECRET"
${SECRET} literal (Claude kept)    "${env:PI_CLAUDE_MARKETPLACE_EMPTY}{SECRET}"                 -> "${SECRET}"
${1X} adapter-only literal         "${env:PI_CLAUDE_MARKETPLACE_EMPTY}{1X}"                     -> "${1X}"
{env: + kept ${X} + }              "{env:{env:PI_CLAUDE_MARKETPLACE_EMPTY}${X}}"                -> "{env:VALX}"
kept ${ENVX} with $ prefix (runtime) "$${ENVX}"                                                 -> "S3NT1NEL"   (residual T4)
arg  "{env:PI_CLAUDE_MARKETPLACE_EMPTY}~/x"  -> "<home>/x"      arg "~user/x" -> "~user/x"
url E set    "https://h/{env:{env:PI_CLAUDE_MARKETPLACE_EMPTY}SECRET}" -> "https://h/{env:SECRET}"
url E unset  same                                                      -> THROWS: Missing environment variable in MCP server URL: PI_CLAUDE_MARKETPLACE_EMPTY
url          "https://h/${UNSET_VAR}"                                  -> THROWS: Missing environment variable in MCP server URL: UNSET_VAR
resolveCommandSecret "!!!x" -> "!!x";  "!!${X}" -> "!VALX";  "!!{env:{env:E}SECRET}" -> "!{env:SECRET}"
interpolateEnvRecord {"A":"!single","B":"!!x"} -> {"A":"!single","B":"!x"}   (hash path; no spawn)
extractOAuthConfig -> {"clientId":"${SECRET}","scope":"{env:SECRET} a","authServerMetadataUrl":"https://m/$env:SECRET"}
resolveOAuthHeaders {H:"a{env:E}b"} with E="" -> THROWS: Missing environment credential in OAuth HTTP headers  (unreachable for our entries)

Bounded-exhaustive (written(raw) through interpolateEnvVars vs Claude output; kept refs at runtime "" and "x"):
  alphabet $ { } e n v : - K ${R} ${K}, length<=5:                       guard on 354,310 checked, 0 mismatches
  alphabet + chunks {env $en v:K :K} ${A:-} ${A:-{env}, length<=4:      guard on 108,480 checked, 0 mismatches
                                                                         guard off 108,480 checked, 102 mismatches, e.g.
  {"raw":"{env${R}:K}","v":"","w":"{env${R}:K}","got":"S","want":"{env:K}"}
  {"raw":"$en${R}v:K","v":"","w":"$en${R}v:K","got":"S","want":"$env:K"}
  {"raw":"${A:-{env}${R}:K}","v":"","w":"{env${R}:K}","got":"S","want":"{env:K}"}
```
