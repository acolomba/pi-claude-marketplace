# Phase 7: Docs and live proof - Context

**Gathered:** 2026-10-09
**Status:** Ready for planning

<domain>
## Phase Boundary

The user docs describe what mcp-4 shipped and every divergence from Claude
Code. A real pi-mcp-adapter proves in a sandboxed agent directory that it
accepts what we write. The CHANGELOG records the milestone, and a version bump
is offered before the PR. Requirements: ADOC-01, ADOC-02, ADOC-03. This
discussion adds one code change: the adapter peer floor moves to 5.2.0
(D-07-07).

Most MCP docs already exist. Phases 3 and 4 wrote `docs/mcp-compatibility.md`
(names, tool search, lifecycle, translated and dropped fields, variables, 18
divergence bullets) and the README name-mapping text. These are still
missing:

- the migration (phase 5) and status in info (phase 6) in the user docs;
- per-tool `alwaysLoad`, project-scope approval prompts, and the adapter
  settings that drop our entries;
- the stale PRD text (`scope/mcp.json` in the overview, the 7.2 journey and the
  diagrams);
- `docs/env-vars.md` (ENVDOC-01) and the `docs/hooks-compatibility.md` claim;
- the CHANGELOG, which has only the 5.1.0 floor bullet.

**Upstream contract:** the phase touches the contract only through what the
docs claim about Claude Code. Two claims needed fresh evidence, E1 and E2
below.

**Settled going in (not re-discussed):**

- Each divergence names its license: a requirement ID or a Pi capability gap.
  Source and docs cite requirement IDs, never `D-07-NN`.
- README.es.md stays in sync with README.md, as in phases 3 and 4.
- The PRD is edited in place, as MC-4 and SC-2 were.
- The house live-canary pattern, the stub provider route, and the scratch
  `npm install --prefix /var/tmp/...` for companions.
- D-03-21: tool search is proven through both `mcp({ search })` and a
  `"defaultTools": ["+tool_search"]` variant. The extension never edits Pi
  settings.
- D-06-06a: in a deferred session, info shows `status unknown` until the first
  MCP use, then a live state.

</domain>

<decisions>
## Implementation Decisions

Decision IDs are milestone-scoped. Docs and source cite requirement IDs
(ADOC-0N, AMIG-0N, ...), never `D-07-NN`.

### Live UAT (ADOC-02)

- **D-07-01:** The model side is the keyless OpenAI-compatible stub
  (`tests/live-uat/openai-stub-server.mjs`), extended to replay a fixed list of
  tool calls. The list is `mcp({ search })`, then `tool_search` with
  `+tool_search` enabled in the sandbox settings, then a call to the tool it
  found. No real model and no key. The canary asserts on Pi's `--mode json`
  (or RPC) event stream: the tool names returned are
  `mcp__plugin_<p>_<s>__<tool>`, and the tool call returns the fixture's
  result. Proving that a real model chooses to search is out of scope.
- **D-07-02:** The UAT is an operator-run canary,
  `tests/live-uat/mcp-adapter-canary.mjs`, outside `npm run check` and CI, like
  the Stop and engine canaries. It gets a `tests/live-uat/README.md` section
  with these parts: Prerequisites, Run, What it asserts, What it routes to
  `human_needed`, a negative control, and Observed result with verbatim
  output. It needs the `fallow-ignore-file unused-file` header that the other
  drivers carry. Running the negative control before trusting a PASS is
  mandatory.
- **D-07-03:** The canary runs against **pi-mcp-adapter 5.2.0 only**, installed
  into a scratch prefix outside the checkout. It is never a dependency. Pi is
  the lockfile-pinned 1.x.
- **D-07-04:** The legacy `mcp.json` entry is **captured once from the
  published v0.19.2 running on Pi 1.x**. Install a fixture plugin with 0.19.2
  on the repository's Pi 1.x in a sandbox. Commit the marked `mcp.json` entry
  and the `state.json` record it writes as a canary fixture. Every canary run
  seeds from that fixture, so it is deterministic and offline. Record the
  capture command and the 0.19.2 version in the fixture header or the README.
  If 0.19.2 does not load on Pi 1.x, stop and report: an older Pi is a
  fallback only with operator approval, because users upgrade on Pi 1.x.
- **D-07-05:** The canary covers what ADOC-02 and D-06-06a name:
  - the adapter loads our entries;
  - the seeded legacy entry migrates on `/reload`, and the canary records how
    many reloads it takes until the new key's tools are live and the old name
    is gone (D-05-15 expects one more `/reload`);
  - tool search finds the plugin tools by both routes in D-07-01;
  - `info` shows `status unknown` before the first MCP use and a live state
    after it.

  It also records whether `scripts/pi.sh`'s `--no-extensions` leaves
  `builtin:tool-search` loaded on Pi 1.x (ROADMAP note).

### Document-only divergences (settles ROADMAP open decision 6)

- **D-07-06:** Per-tool `_meta["anthropic/alwaysLoad"]` (E1) and project-scope
  approval prompts (E2) are **documented only**. No upstream issue is filed or
  drafted.
  - alwaysLoad is a Pi capability gap. The adapter ignores tool `_meta`, and
    tool names are unknown when the entry is written.
  - The approval prompt is licensed by settled decision 8 (never touch the
    adapter's approval files, NFR-10), and the adapter owns project trust.
    Info already shows `pending approval` (D-06-01).

  The docs say that a project-scope plugin's servers prompt at install and
  again after each update, and that headless sessions skip unapproved ones.
- **D-07-08:** `docs/mcp-compatibility.md` gets a short section on the adapter
  settings that change or drop plugin servers, with a link to the adapter's
  docs:
  - `PI_MCP_CONFIG_MODE=exclusive` reads only the global Pi file, so
    project-scope plugin servers do not load;
  - `--mcp-config <file>` replaces the user file path, so user-scope plugin
    servers do not load;
  - `MCP_DIRECT_TOOLS` overrides the `directTools` we write.

  No detection or warning in code. The researcher verifies each effect
  against the adapter 5.2.0 source before the text is written.

### Adapter floor (amends settled decision 5, PIFL-03, D-04-12, D-04-17)

- **D-07-07:** The `pi-mcp-adapter` optional peer becomes **`>=5.2.0 <6`**.
  5.2.0 moves the MCP SDK to 2.3.1 and fixes GHSA-6qxp-vccf-f47h: a malicious
  MCP server could collect the refresh token and client secret saved from an
  earlier sign-in. That matters for an extension that installs third-party MCP
  servers. The change touches:
  - `package.json` (peer range) and the lock;
  - `scripts/pi.sh` pin;
  - the CI `integration` job pin (`.github/workflows/ci.yml`) and its
    `PI_MCP_ADAPTER_ROOT` install;
  - `tests/architecture/peer-floor.test.ts`;
  - every version pin in the conformance and status tests
    (`tests/integration/mcp-status-conformance.test.ts`, the AVAR-03
    conformance test);
  - source comments that name 5.1.0 (`bridges/mcp/adapter-doc.ts`,
    `platform/mcp-status.ts`);
  - README, README.es and `docs/mcp-compatibility.md`;
  - `docs/output-catalog.md` where it names the version.

  Not every `5.1.0` string in the tree is the adapter, so verify each hit.
  The conformance tests are re-run against 5.2.0. If a conformance fact
  changed in 5.2.0, stop and report it, and do not adjust the code silently.
  REQUIREMENTS.md PIFL-03 and ROADMAP settled decision 5 are amended to cite
  D-07-07. The docs name the advisory and 5.2.0's side effect: a server URL
  that redirects to another host is no longer followed.
  — **Reversibility:** costly — a published peer range. Lowering it again
  re-admits the vulnerable SDK and needs every pin moved back.

### Upgrade notes and CHANGELOG (ADOC-03)

- **D-07-09:** The upgrade guidance lives in a new **"Upgrading"** section of
  `docs/mcp-compatibility.md`. It gives the old-to-new name rule
  (`github -> plugin_<plugin>_github_`) and each cost with its fix:
  - OAuth servers need a new sign-in (sign-ins are keyed by name);
  - project servers need approval again;
  - a second `/reload` before the renamed tools appear;
  - pi-subagents `mcp:<old-name>` overrides and agent files that name old
    server or tool names must be edited by hand, because the migration does
    not rewrite them (phase 5 deferred note);
  - entries the migration leaves in place, and their remedies (D-05-02,
    D-05-11, AMIG-04).

  The CHANGELOG gets a short "Action needed after upgrading" bullet that
  links to the section.
- **D-07-10:** The CHANGELOG entry uses **grouped bullets** in the existing
  user-facing style, under `[Unreleased]`:
  - Pi 1.0 floor (PIFL-01), with any Node and companion-floor notes the
    `[Unreleased]` section does not already carry;
  - the adapter 5.2.0 floor and the advisory, replacing the existing 5.1.0
    bullet;
  - one "Plugin MCP servers now go into pi-mcp-adapter's `mcp-adapter.json`"
    bullet with sub-bullets: Claude Code tool names, tool search, variable
    rules and withheld credentials, partial installs for unsupported
    features, permission-rule warnings (D-05-05), the automatic migration;
  - status in info;
  - the action-needed bullet;
  - internal changes under `Internal:`.

  Existing `[Unreleased]` bullets from main stay as they are. PR numbers are
  added once the PR exists.
- **D-07-11:** The bump offer before the PR proposes **0.20.0**: a minor bump,
  the semver 0.x rule for breaking changes. The bump itself happens at PR time
  on operator acceptance. On acceptance it updates all of these together:
  `package.json`, the lock, `EXTENSION_VERSION` in
  `shared/extension-version.ts`, `sonar.projectVersion`, and the CHANGELOG
  heading `[Unreleased]` -> `## [0.20.0] - <date>`. The phase does not bump
  on its own.

### Docs structure (ADOC-01)

- **D-07-12:** The migration ("Upgrading", D-07-09) and the status in info
  ("Server status in info") are new sections of `docs/mcp-compatibility.md`,
  the MCP home. README and README.es each gain one linking sentence, the same
  way their naming and partial-install text links there today. The status
  section lists every token and what it means:
  - `connected`, `cached, connects on first use`, `needs authentication`,
    `pending approval`, `disabled`, `not connected`, `failed`;
  - `status unknown`, `not loaded`, `overridden by project scope`.

  It covers deferred sessions (D-06-06a). It points at
  `docs/output-catalog.md` for exact bytes.
- **D-07-13:** The divergence list stays as **prose bullets** that name their
  license. It is grouped under short subheadings (naming, loading, variables,
  migration, status). The new items join it:
  - project-scope approval prompts and per-tool alwaysLoad (D-07-06);
  - `failed` kept apart from `not connected` (D-06-01);
  - permission rules installed with a warning and not enforced (D-05-05);
  - migration specifics (malformed -> whole MCP component removed, D-05-07;
    nothing carried from legacy entries, D-05-09);
  - same-reload visibility (the second `/reload`);
  - the adapter settings (D-07-08).

  The existing bullets are kept, not rewritten.
- **D-07-14:** The PRD update covers **every MCP mention**, in place:
  - the overview and the `scope/mcp.json` text;
  - the 5.8 MC rows;
  - SC-2 and NFR-10 (`mcp-adapter.json` in the write set; `mcp.json` kept
    for legacy entries until the migration window closes);
  - the 7.2 user journey;
  - the state and architecture diagrams.

  Requirement rows are added only where a shipped behavior has none yet:
  migration (AMIG), status (ASTAT), the variable rules (AVAR).

### Claude's Discretion

- The MCP server fixture for the canary: a dependency-free stdio JSON-RPC
  server committed under `tests/live-uat/`, or the MCP SDK from the scratch
  adapter install, and the fixture plugin and local marketplace layout.
  Whether to add a second server (for example remote with auth) is optional;
  ADOC-02 does not require it.
- The stub's script format (environment variable or JSON file per request)
  and how the canary drives `/reload` and `/claude:plugin info`: RPC through
  `tests/e2e/_rpc.ts` patterns, or `--mode json`.
- What to do if `--no-extensions` drops `builtin:tool-search`: fix
  `scripts/pi.sh` to load it, or document it, whichever is smaller and
  correct.
- How deep the `docs/env-vars.md` (ENVDOC-01) rewrite goes. It must at least
  match D-04-01..D-04-19: the five expansion fields, `${VAR:-default}`, the
  `PI_CLAUDE_MARKETPLACE_EMPTY` reserved variable, `CLAUDE_PROJECT_DIR`
  exported at session start (which replaces the stale "User-scope
  `${CLAUDE_PROJECT_DIR}` pass-through" section), and the withheld
  credentials. Which `docs/hooks-compatibility.md` claims need updating.
- Plan split and wave order. The floor raise (D-07-07) should land before the
  canary run and before the docs that name the version.

</decisions>

<compat_evidence>
## Claude Code evidence records

### E1: per-tool `_meta["anthropic/alwaysLoad"]`
- **Behavior:** Claude Code 2.1.294 computes per tool `alwaysLoad: !S && ((C
  && !(mode === "dynamic" && _meta["anthropic/alwaysLoad"] === false)) ||
  _meta["anthropic/alwaysLoad"] === true)`. A tool that its server reports
  with `_meta["anthropic/alwaysLoad"]: true` is always in the prompt, even when
  its server is deferred. Under a server `alwaysLoad: true`, a tool with meta
  `false` stays deferred. Server `alwaysLoad: true` also blocks startup until
  the server connects (5 s cap).
- **Evidence:** `grep -oa` over
  `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.294/claude`,
  2026-10-09 (the server schema `describe` text and the tool-object builder).
- **Confidence:** high for the rule; medium for what `S` gates.
- **Pi constraints:** pi-mcp-adapter 5.1.0 has no `_meta` or `alwaysLoad`
  handling (grep of the scratch install). `directTools: string[]` needs tool
  names when the entry is written, and we write entries before any tool list
  is known.
- **Divergence:** tools that ask to always load stay deferred. License: Pi
  capability gap. Document only (D-07-06).

### E2: approval of plugin MCP servers
- **Behavior:** Claude Code 2.1.294 requires approval only for servers with
  `scope === "project"`, which are `.mcp.json` servers (`p5t` returns
  `"project-approval"` unless approved; `enabledMcpjsonServers` is "List of
  approved MCP servers from .mcp.json"). Plugin servers never wait for
  approval.
- **Evidence:** `grep -oa` over the same 2.1.294 binary, 2026-10-09.
- **Confidence:** high.
- **Pi constraints:** pi-mcp-adapter blocks every server from a project file,
  `<cwd>/.pi/mcp-adapter.json` included. In untrusted projects it blocks
  them. In trusted interactive sessions it asks, with "Don't allow" as the
  default. Headless sessions skip them. The approval covers the full
  definition, and the plugin root path changes on update, so a project-scope
  plugin asks again after every update (research FEATURES A11, G-10).
  Pre-approving would write the adapter's approval files or user-global
  `projectServers`, which settled decision 8 and NFR-10 forbid.
- **Divergence:** project-scope plugin servers need the adapter's approval.
  License: project decision (settled decision 8, NFR-10) and the adapter
  owning project trust. Document only (D-07-06).

</compat_evidence>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — ADOC-01..03; PIFL-03 (amended by D-07-07)
- `.planning/ROADMAP.md` — Phase 7 criteria and note, settled decisions 5 and
  8, open decision 6

### Prior decisions to document
- `.planning/phases/03-claude-code-tool-names-and-tool-search/03-CONTEXT.md` —
  names, tool search, closed translation, divergences D-03-13/17/18/21
- `.planning/phases/04-variable-expansion-at-claude-code-parity/04-CONTEXT.md`
  — variable rules, deny-list, `PI_CLAUDE_MARKETPLACE_EMPTY`,
  `CLAUDE_PROJECT_DIR`, floor history (D-04-12, D-04-17, D-04-18)
- `.planning/phases/05-automatic-migration-on-reload/05-CONTEXT.md` — the
  migration, notice, costs, D-05-05 permission rules, deferred pi-subagents
  note
- `.planning/phases/06-live-mcp-status-in-info/06-CONTEXT.md` — status tokens,
  unknown states, D-06-06a, D-06-09
- `.planning/research/FEATURES.md` — A11 project trust, G-6, G-10, G-13
- `.planning/research/SUMMARY.md` — the close-out phase deliverables list

### Docs to update
- `docs/mcp-compatibility.md` — MCP home: new Upgrading, Server status in info
  and adapter-settings sections, plus the divergence list
- `README.md`, `README.es.md` — linking sentences, adapter floor
- `docs/env-vars.md` — ENVDOC-01
- `docs/hooks-compatibility.md` — the MCP hook claims
- `docs/prd/pi-claude-marketplace-prd.md` — overview, §5.8, SC-2/NFR-10, §7.2,
  §8–§9 diagrams
- `docs/output-catalog.md` — exact bytes of status, migration and warning
  rows (reference, plus the version mention)
- `CHANGELOG.md` — `[Unreleased]`

### Live UAT
- `tests/live-uat/README.md` — canary section structure and Observed result
  convention
- `tests/live-uat/openai-stub-server.mjs` — the keyless stub to extend
- `tests/live-uat/stop-canary.mjs` — Pi spawn, `--mode json` parsing, sandbox
  and teardown pattern
- `tests/e2e/_rpc.ts`, `tests/e2e/adapter-detection-rpc.test.ts` — RPC driving
  of real Pi, path-source marketplace and install, info capture
- `scripts/pi.sh` — companion pins and `--no-extensions`

### Adapter
- pi-mcp-adapter 5.2.0 (scratch: `npm pack pi-mcp-adapter@5.2.0`) —
  `CHANGELOG.md` (GHSA-6qxp-vccf-f47h, redirect side effect), `config.ts`
  (`isExclusiveConfigMode`, `getConfigSources`), `index.ts` and `init.ts`
  (`MCP_DIRECT_TOOLS`, `--mcp-config`), `project-server-trust.ts`,
  `docs/configuration.md`

### Floor raise touch points
- `package.json`, `package-lock.json`, `scripts/pi.sh`,
  `.github/workflows/ci.yml`, `tests/architecture/peer-floor.test.ts`,
  `tests/integration/mcp-status-conformance.test.ts`, the AVAR-03
  conformance test, `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts`,
  `extensions/pi-claude-marketplace/platform/mcp-status.ts`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/live-uat/openai-stub-server.mjs`: the keyless provider. It logs the
  requested tool names, and it needs a scripted tool-call mode.
- `tests/e2e/_rpc.ts`: `runRpcSession`, `listedCommands`,
  `promptDisposition`. These drive real Pi over RPC and capture notify
  output.
- `tests/platform/hermetic-environment.ts`: a hermetic `$HOME` and agent
  directory.
- `scripts/pi.sh`: the companion runtime prefix (by default
  `~/.cache/pi-claude-marketplace/pi-runtime`).

### Established Patterns
- Canaries tear down in `finally`. Assertions belong in `main`'s `try`. A
  canary's exit code is never read through a pipe.
- Scratch companion installs go under `/var/tmp` (`/tmp` is tmpfs and can run
  out of inodes). `package.json` is never touched, which
  `git diff --stat` checks.
- Docs: plain-English, active-voice prose (the simple-english style). Every
  divergence bullet ends with "Reason: ... (<REQ-ID>)" or names a Pi
  capability gap. Markdown is formatted by mdformat, not prettier.
- Closed-catalog text is quoted from `docs/output-catalog.md`, never
  reworded in other docs.

### Integration Points
- The CHANGELOG `[Unreleased]` section is shared with main's unreleased work.
- The version-sync test (`tests/architecture/extension-version-sync.test.ts`)
  binds `EXTENSION_VERSION` to `package.json` at bump time.

</code_context>

<specifics>
## Specific Ideas

- Canary file name: `tests/live-uat/mcp-adapter-canary.mjs`.
- Upgrade-cost example in the docs: `github -> plugin_acme_github_ (acme)
  [user]`, the D-05-13 notice form.

</specifics>

<deferred>
## Deferred Ideas

- A nightly run of the canary against the latest 5.x adapter, to catch
  upstream drift. Not chosen now; the canary is operator-run.
- Upstream adapter requests (honor `_meta["anthropic/alwaysLoad"]`, keep
  project approval across plugin-root changes). The operator chose document
  only.
- Carried from phase 4: an upstream bug report on the adapter's
  `claudePlugins` loader. It still needs operator go-ahead.

</deferred>

---

*Phase: 07-docs-and-live-proof*
*Context gathered: 2026-10-09*
