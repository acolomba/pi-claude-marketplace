# Phase 7: Docs and live proof - Research

**Researched:** 2026-10-09
**Domain:** user documentation, a live operator-run UAT canary against real Pi 1.0.0 + pi-mcp-adapter 5.2.0, an optional-peer floor raise, CHANGELOG/version bump
**Confidence:** HIGH (every load-bearing runtime claim was observed live in a hermetic sandbox this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Decision IDs are milestone-scoped. Docs and source cite requirement IDs
(ADOC-0N, AMIG-0N, ...), never `D-07-NN`.

#### Live UAT (ADOC-02)

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

#### Document-only divergences (settles ROADMAP open decision 6)

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

#### Adapter floor (amends settled decision 5, PIFL-03, D-04-12, D-04-17)

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

#### Upgrade notes and CHANGELOG (ADOC-03)

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

#### Docs structure (ADOC-01)

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

### Deferred Ideas (OUT OF SCOPE)

- A nightly run of the canary against the latest 5.x adapter, to catch
  upstream drift. Not chosen now; the canary is operator-run.
- Upstream adapter requests (honor `_meta["anthropic/alwaysLoad"]`, keep
  project approval across plugin-root changes). The operator chose document
  only.
- Carried from phase 4: an upstream bug report on the adapter's
  `claudePlugins` loader. It still needs operator go-ahead.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADOC-01 | README, `docs/env-vars.md` (ENVDOC-01), `docs/hooks-compatibility.md` and the PRD/NFR-10 text describe adapter-file delivery, naming, tool search, variable rules and the documented divergences. | "Docs gap inventory" lists every stale passage with file:line; "Adapter settings that drop plugin servers" gives source-verified text for D-07-08; live observations (deferred session, `not loaded` after the move, one reload) feed the Upgrading and status sections. |
| ADOC-02 | A live UAT in a sandboxed agent directory proves adapter 5 loads our entries, migrates a seeded legacy entry (counting reloads), finds plugin tools through tool search, and shows status in info. | "Live canary design" — the full flow was run end to end in this research on Pi 1.0.0 + adapter 5.2.0 + v0.19.2 seed; transcripts, the scripted-stub shape, the RPC driver, the reload helper extension and four pitfalls are recorded. |
| ADOC-03 | CHANGELOG records the milestone, and a version bump is offered before the PR. | "CHANGELOG inventory" (present vs missing) and "Version-bump touch points". |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Never commit to `main`; Conventional Commits; title 5-72 chars; body lines <= 80; no GSD milestone/phase mentions in commit messages or PR titles.
- Before `git commit`: `SKIP=npm-check pre-commit run --files <changed files>`; restage after fixers; then `git commit` in the foreground with the longest timeout. Never `--no-verify`, never `--amend` after a failed hook, never rebase.
- PR descriptions: `simple-english` (Plain) + `humanizer`. `gh pr merge --squash` only. Before a milestone-shipping PR merge: `/gsd-audit-milestone` then `/gsd-complete-milestone` on the PR branch.
- Every plan `SUMMARY.md` includes `## Threat Flags` (even "None").
- `gsd-tools windows append --description` prefixed with `[mcp-4]`.
- TypeScript rules: `skills/typescript-google-style-review`, `skills/typescript-comments` for every `.ts`; unit-testing skills for `tests/**/*.ts`. (The canary is `.mjs`, outside ESLint and tsc, but its comments still follow the comment rules: cite requirement IDs, no phase/plan numbers.)
- Build verification per `skills/local-verification`: GSD gates run `npm run check`. `docs/output-catalog.md`, everything under `tests/**`, `package.json`, `package-lock.json`, `sonar-project.properties`, `.github/workflows/**` and `scripts/**/*.mjs` are build inputs; `scripts/pi.sh`, README*, CHANGELOG and the other `docs/*.md` are not. [VERIFIED: .github/workflows/ci.yml:14-32]
- Versioning: before creating a PR, offer to bump `package.json`, `sonar-project.properties`, the lock; record changes in `CHANGELOG.md`.
- Upstream parity is the default; a divergence needs a recorded project decision (with ID) or a Pi capability gap.
- Containment (NFR-10): never write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, `<scopeRoot>/mcp-adapter.json`, `<scopeRoot>/mcp.json` (legacy).
- Output: all user-visible messages via the notification dispatch (IL-2). The canary is a standalone harness and prints with `console.*` like its siblings (it is outside `extensions/**`, where the rule pack applies).
- `.claude/rules/readme.md`: every `README.*.md` change is mirrored in the same commit; apply `simple-english` (Plain) and `humanizer` to added prose.
- Memory notes that bind this phase: subagent/canary tests must use a hermetic home; `/tmp` is a tmpfs with an inode cap (use `/var/tmp`); never read a canary's exit code through a pipe; always run the negative control before trusting a PASS; Markdown is formatted by mdformat (pre-commit), not Prettier; JSON under `tests/` is covered by `prettier --check`.

## Summary

Every research question has a measured answer. Adapter 5.2.0 changes nothing that this extension's conformance facts depend on. Compared with 5.1.0, only `index.ts`, `proxy-modes.ts`, `jev-key-store.ts`, `cli.js`, docs, `CHANGELOG.md` and `package.json` differ. `config.ts`, `types.ts`, `utils.ts`, `server-manager.ts`, `mcp-auth-flow.ts`, `mcp-status.ts`, `metadata-cache.ts` and `project-server-trust.ts` are byte-identical. Both conformance suites pass 55/55 unchanged against a scratch 5.2.0 (`PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter`). So the floor raise is a version-string change plus the CI pin, the `scripts/pi.sh` pin and the 5.1.0 labels in comments and docs. One touch point is missing from D-07-07's list: `tests/bridges/mcp/adapter-entry.test.ts` pins the range literal and the 5.1.0 `dist.shasum`. Its cited `types.ts` and `config.ts` line numbers stay valid, because those files did not change.

The full ADOC-02 flow was run live in this research on the repository's Pi 1.0.0 with adapter 5.2.0, over Pi's RPC mode, in a hermetic `/var/tmp` sandbox. Published v0.19.2 loads on Pi 1.0.0 and writes the legacy entry. Seeded into the current extension's sandbox, the entry migrates at load, and exactly **one** reload makes `plugin_echo_echo_` live while the old `echo` name disappears from the adapter's status snapshot. A second reload gives a deferred session in which info shows `(status unknown)`. A scripted stub then drives `mcp({ search })` → call, or `tool_search` → call. Both return `mcp__plugin_echo_echo__echo_canary` and the fixture result, and info then shows `(connected)`. `--no-extensions` on Pi 1.0.0 **drops** `builtin:tool-search`, and adding `-e builtin:tool-search` restores it.

The research also found two traps that would break a naive canary. (1) If `tool_search` runs in the same turn after `mcp({ search })`, it returns `No matching tools found.`, because the adapter's search already activated the tool and `tool_search` only searches inactive tools. The two routes must run in separate fresh Pi sessions, or `tool_search` must run first. (2) RPC has no built-in `/reload`: a prompt `/reload` is not an extension command, so it would go to the model. The canary needs a tiny helper extension that registers a command calling `ctx.reload()`.

**Primary recommendation:** Land D-07-07 first (one small plan). Then build the canary as a self-contained RPC driver: a sandbox under `os.tmpdir()` outside the repository, a helper extension and stdio MCP server written into the sandbox at run time, a committed seed fixture with a sandbox-root placeholder, and a scripted stub that picks a script by a marker in the user prompt. Write the docs after the canary run, so they can cite its observed results.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Peer floor (`>=5.2.0 <6`) | Package manifest (`package.json`, lock) | CI job pin, `scripts/pi.sh` pin, architecture/unit pins | The range is the published contract. CI, pi.sh and tests mirror it. |
| Reading our `mcp-adapter.json` | pi-mcp-adapter (external Pi extension) | — | The adapter owns loading, trust and status. We only prove that it accepts what we write. |
| Legacy move on load | Extension `resources_discover` (reconcile) | adapter (picks up after reload) | Already shipped (AMIG). The canary observes it. |
| Status in info | Extension info command (reads `pi-mcp-adapter/status/v1`) | adapter (publishes snapshots) | Already shipped (ASTAT). The canary observes it. |
| Model-side tool calls | Keyless stub (`openai-stub-server.mjs`) | Pi's openai-completions provider | Deterministic replay. No real model. |
| Driving Pi | Canary harness (Node `child_process`, RPC JSONL) | helper extension inside the sandbox (reload, wait, status tap) | RPC is the only mode that forwards `ctx.ui.notify` and accepts many steps. |
| User docs | `docs/mcp-compatibility.md` (MCP home) | README/README.es (one linking sentence), env-vars, hooks-compat, PRD, output-catalog | D-07-12 places new sections in the MCP home. |

## Standard Stack

No new dependency enters the repository. The phase uses only what is installed or scratch-installed.

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| `@earendil-works/pi-coding-agent` (devDep, lock-pinned) | 1.0.0 | The Pi that the canary drives | `tests/pi-runtime.ts` resolves `node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js` [VERIFIED: resolvePiRuntime output this session] |
| `pi-mcp-adapter` (scratch only) | 5.2.0, published 2026-10-09, `dist.shasum 9950f0b4423371c7a7839d67d7e20cade3debc69` | The adapter the canary proves against | D-07-03. [VERIFIED: npm registry] |
| `pi-claude-marketplace` (scratch only, for the one-time capture) | 0.19.2 | Writes the legacy `mcp.json` entry and `state.json` record | D-07-04. [VERIFIED: npm registry; loaded live on Pi 1.0.0] |
| Node `node:http`, `node:child_process`, `node:readline` | Node 22.22+/24/26 | Stub, Pi spawn, JSONL parsing | Already used by `openai-stub-server.mjs`, `stop-canary.mjs`, `tests/e2e/_rpc.ts`. |

### Supporting
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `tests/pi-runtime.ts` `resolvePiRuntime(repoRoot)` | Resolves the repository's Pi CLI, never a `pi` on PATH | Every Pi launch in the canary |
| `tests/e2e/_rpc.ts` | Pattern reference only (env allowlist, process-group kill, dialog cancel) | Copy its patterns. Do not import it, because it collects no events and has no reload. See Pitfall 4. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RPC driver | `--mode json` (`pi -p`) | Print/json mode makes `ctx.ui.notify` a no-op, so info output is invisible, and one process gives one prompt. RPC is required. |
| Dependency-free stdio MCP server written by the canary | The MCP SDK from the scratch adapter | The SDK adds a module-resolution coupling to the scratch prefix. The 25-line JSON-RPC server below worked live with adapter 5.2.0 (`initialize`, `tools/list`, `tools/call`, `ping`). |
| Committed `.ts` helper extension | Helper source written into the sandbox at run time | A committed `.ts` under `tests/` would be typechecked (tsconfig includes `tests/**/*.ts`) and analyzed by fallow as an unused file. Writing it at run time follows the stop-canary precedent, which writes its hook script at run time. |

**Installation (scratch, outside the checkout, never into the repository):**
```bash
mkdir -p /var/tmp/mcp4-adapter
npm install --prefix /var/tmp/mcp4-adapter pi-mcp-adapter@5.2.0 --ignore-scripts --omit=peer --no-audit --no-fund
# one-time capture only:
mkdir -p /var/tmp/mcp4-v0192
npm install --prefix /var/tmp/mcp4-v0192 pi-claude-marketplace@0.19.2 --legacy-peer-deps --ignore-scripts --no-audit --no-fund
```
Both commands were run this session. The `--ignore-scripts --omit=peer` adapter install loads and serves stdio servers under Pi 1.0.0. Pi supplies the peers. The keyring native module is not needed for a server without OAuth. [VERIFIED: live run]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| pi-mcp-adapter@5.2.0 | npm | published 2026-10-09 (today); package since 2026-01-19 | 415,538/wk | github.com/nicobailon/pi-mcp-adapter | [SUS] (`too-new`) | Flagged. Same publisher as 5.1.0 (`nicopreme`); no `postinstall`; `npm audit --omit=dev` on the scratch install: 0 vulnerabilities. The operator chose this exact version in D-07-07. Planner: one `checkpoint:human-verify` before the first scratch install, which the operator decision may satisfy. |
| pi-claude-marketplace@0.19.2 | npm | published 2026-09-25 | 362/wk | github.com/acolomba/pi-claude-marketplace | [SUS] (`too-new`, `low-downloads`) | Flagged by heuristic only. It is this project's own published release (D-07-04). Same checkpoint note. |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** pi-mcp-adapter@5.2.0, pi-claude-marketplace@0.19.2. Both are scratch-only installs outside the repository, and neither enters `package.json` or the lock.

## D-07-07: the floor raise

### Every `5.1.0` hit, classified

`git grep -n "5\.1\.0"` outside `.planning/` and the lock (plus the lock and every adapter mention without the exact string):

| File:line | Text (verbatim) | Adapter? | Action |
|-----------|-----------------|----------|--------|
| `package.json:61` | `"pi-mcp-adapter": ">=5.1.0 <6",` | yes | → `">=5.2.0 <6"` [VERIFIED: package.json:58-64] |
| `package-lock.json:44` | `"pi-mcp-adapter": ">=5.1.0 <6",` (root `peerDependencies`) | yes | Regenerate with `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`. The previous floor raise produced a 1-line diff (`261007-9a2-SUMMARY.md:140-142`). |
| `package-lock.json:4232` | `"estraverse": "^5.1.0"` | **no** | leave |
| `.github/workflows/ci.yml:121` | `npm install --prefix "$RUNNER_TEMP/pi-mcp-adapter" pi-mcp-adapter@5.1.0 --ignore-scripts --omit=peer --no-audit --no-fund # zizmor: ignore[adhoc-packages]` | yes | → `@5.2.0`. `PI_MCP_ADAPTER_ROOT` (line 125) needs no change. [VERIFIED: ci.yml:115-125] |
| `scripts/pi.sh:111` | `"pi-mcp-adapter@5.1.0"` | yes | → `@5.2.0` [VERIFIED: scripts/pi.sh:110-114] |
| `tests/architecture/peer-floor.test.ts:84,93,122` | title `... at >=5.1.0 <6 (PIFL-03)`, `assert.equal(range, ">=5.1.0 <6");`, `assert.equal(pkgRange, ">=5.1.0 <6");` | yes | → `>=5.2.0 <6` [VERIFIED: peer-floor.test.ts:84-123] |
| `tests/bridges/mcp/adapter-entry.test.ts:13,54,1047,1073` | `// pi-mcp-adapter@5.1.0 types.ts:438-527 (ServerEntry), dist.shasum 2befb4f1898122790e9fc3398c9e7b814ee9293e`, the same for `types.ts:397-422 (OAuthConfig)`, `// pi-mcp-adapter@5.1.0 (dist.shasum 2befb4f1898122790e9fc3398c9e7b814ee9293e)`, and `">=5.1.0 <6",` | yes | **Not in D-07-07's list.** Label → `5.2.0`, shasum → `9950f0b4423371c7a7839d67d7e20cade3debc69`, range → `>=5.2.0 <6`. The line numbers stay valid: `types.ts`, `config.ts`, `agent-plugin-provenance.ts`, `metadata-cache.ts` and `project-server-trust.ts` are identical in 5.1.0 and 5.2.0. The test's failure message requires re-proving these facts, and the diff below re-proves them. [VERIFIED: adapter-entry.test.ts:1047-1079; diff -rq] |
| `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts:4` | `// back. The read grammar is pi-mcp-adapter 5.1.0's loader grammar by` | yes | → `5.2.0` (the loader grammar is unchanged; `strip-json-comments ^5.0.3` in both) |
| `extensions/pi-claude-marketplace/platform/mcp-status.ts:40` | `/** The seven server statuses pi-mcp-adapter 5.1.0 reports, verbatim. */` | yes | → `5.2.0` (`mcp-status.ts`/`types.ts` identical) [VERIFIED: mcp-status.ts:40-42] |
| `tests/integration/mcp-override-lifecycle.test.ts:334,467` | `// pi-mcp-adapter 5.1.0's \`/mcp-adapter enable plugin_hello_srv_\` removes` | yes | Optional relabel. The fact holds in 5.2.0 because `config.ts` is unchanged. |
| `README.md:40`, `README.es.md:40` | `5.1.0 or a later 5.x release` / `5.1.0 o una versión 5.x posterior` | yes | → 5.2.0 (both in the same commit) |
| `docs/mcp-compatibility.md:226` | `...the functions of pi-mcp-adapter 5.1.0 ... The peer range of this extension for pi-mcp-adapter is \`>=5.1.0 <6\`.` | yes | → 5.2.0 |
| `docs/output-catalog.md:2607` | `pi-mcp-adapter 5.1.0 sends an empty snapshot at every session start.` | yes | → `5.2.0` (or "5.1.0 and later"). Build input: `catalog-contract` parses this file. |
| `CHANGELOG.md:5` | `- Plugin MCP servers now need pi-mcp-adapter 5.1.0 or newer, the first adapter release that supports Pi 1.0.` | yes | Replace per D-07-10 |
| `tests/orchestrators/marketplace/update.messaging.test.ts:350,368`, `tests/orchestrators/plugin/update-row.test.ts:202,218` | `toVersion: "5.1.0"` etc. | **no** (generic version fixtures) | leave |
| `docs/prd/...:18-23,173-227` | `5.1 Marketplace Lifecycle`, `5.1.1`... | **no** (section numbers) | leave |
| `tests/integration/adapter-expansion-conformance.test.ts`, `tests/integration/mcp-status-conformance.test.ts`, `tests/integration/pi-mcp-adapter-peer.ts` | no version literal. The peer range comes from `package.json` (`readDeclaredPeerRange`), and an out-of-range root throws. | — | No edit needed. After the raise, a local run with a 5.1.0 root **throws by design**. |
| `.planning/REQUIREMENTS.md:23-27` (PIFL-03), `.planning/ROADMAP.md:56-58` (settled decision 5) | `>=5.1.0 <6` / `>=5.1.0` | yes | Amend to cite D-07-07 (decision text) |
| `.planning/PROJECT.md:22,45,606`, `.planning/codebase/STACK.md:35` | `>=5.1.0` | yes | Optional planning-doc refresh. STACK.md is @-included by AGENTS.md. |
| `docs/mcp-compatibility.md:7,57` | `pi-mcp-adapter 5.0.0 on Pi 1.0.0`, the 2026-10-06 measurement | historical | Line 7 should name the new canary run (5.2.0). Line 57 is a dated measurement: keep it. |
| `scripts/pi.sh:20-21,207` | `adapter 5 adds "-builtin:mcp"` | yes, still true | No change: pi.sh passes no `--mcp-config`, so 5.2.0 still writes the entry. |

### 5.1.0 → 5.2.0 diff (what changed and what didn't)

`diff -rq` between `/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter` (5.1.0) and `/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter` (5.2.0), ignoring `.map` files, shows only these differences: `CHANGELOG.md`, `cli.js`, `dist/jev-key-store.js`, `docs/configuration.md`, `docs/scripting.md`, `docs/tools.md`, `index.ts`, `jev-key-store.ts`, `package.json`, `proxy-modes.ts`. [VERIFIED: diff -rq this session]

- `index.ts`: one hunk. When an explicit config path is set, the adapter no longer adds `"-builtin:mcp"` to the user settings (`earlyConfigPath === undefined` guard).
- `proxy-modes.ts`: `mcp({ server })` lists parameter names, such as `get_record(record_id, fields?)`.
- `package.json`: `@modelcontextprotocol/client` and `core` `2.0.0` → `2.3.1`. The `pi-ai` peer range is unchanged and still admits `^1.0.0`.
- Unchanged, so every conformance fact holds: the `mcp-adapter.json` grammar (`config.ts`), `ServerEntry`/`OAuthConfig` (`types.ts`), the nine-source order (`config.ts` `getConfigSources`), the status channel `pi-mcp-adapter/status/v1` and its snapshot (`types.ts:18`, `mcp-status.ts`), the expansion functions (`utils.ts`, `server-manager.ts`, `mcp-auth-flow.ts`), and project trust (`project-server-trust.ts`).

**Conformance re-run (5.2.0):** `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter TMPDIR=/var/tmp/... node --test tests/integration/adapter-expansion-conformance.test.ts tests/integration/mcp-status-conformance.test.ts` → `tests 55, pass 55, fail 0, skipped 0`. This includes both drift guards: "pi-mcp-adapter's call sites and interpolation passes are the ones the escape relies on" and "pi-mcp-adapter's status union, channel and snapshot version are the ones info maps". No conformance fact changed, so there is nothing to stop and report. [VERIFIED: live test run]

**Advisory facts for the docs and CHANGELOG:** GHSA-6qxp-vccf-f47h, "MCP TypeScript SDK: OAuth client could send credentials to an authorization server chosen by the MCP server", High (CVSS 7.5). It affects `@modelcontextprotocol/client` 2.0.0–2.1.0 and is patched in 2.2.0. [CITED: github.com/advisories/GHSA-6qxp-vccf-f47h] The 5.1.0 scratch ships client `2.0.0`, and `npm audit` flags "2 high severity vulnerabilities" naming this advisory. The 5.2.0 scratch ships `2.3.1`, and `npm audit` reports 0 vulnerabilities. [VERIFIED: npm audit this session] Side effect, from the adapter CHANGELOG 5.2.0 "Security": "a server URL that redirects to a different host is no longer followed, so put the final URL in your config. A redirect from `http` to `https` on the same host still works." [CITED: pi-mcp-adapter 5.2.0 CHANGELOG.md]

## D-07-08: adapter settings that change or drop plugin servers (verified against 5.2.0 source)

| Setting | Effect on our entries | Evidence |
|---------|----------------------|----------|
| `PI_MCP_CONFIG_MODE=exclusive` (trimmed, case-insensitive) | The adapter reads exactly one file: the user file (`<agent dir>/mcp-adapter.json`, or the `--mcp-config` path). **Project-scope plugin servers (`<cwd>/.pi/mcp-adapter.json`) do not load.** User-scope ones still load. Exclusive mode also skips the shared/`.agents` imports, Pi's own `mcp.json` files (where legacy entries live), ancestor discovery, `claudePlugins` and agent plugins. | `config.ts:890-892` `return process.env.PI_MCP_CONFIG_MODE?.trim().toLowerCase() === "exclusive";` and `config.ts:685-695` (`if (isExclusiveConfigMode()) { return [{ id: "pi-global", label: "Pi exclusive config", readPath: userPath, ... }]; }`), plus `config.ts:316,362,378,383,472,516` [VERIFIED: 5.2.0 config.ts read this session] |
| `--mcp-config <file>` (or `--mcp-config=<file>`; also `createMcpAdapter({ configPath })`) | `getPiGlobalConfigPath(overridePath)` returns the override instead of `<agent dir>/mcp-adapter.json`, so **user-scope plugin servers do not load**. The project files (`<cwd>/.mcp.json`, `<cwd>/.pi/mcp.json`, `<cwd>/.pi/mcp-adapter.json`) and `<agent dir>/mcp.json` are still read, so project-scope plugin servers still load. In 5.2.0 such a run also leaves Pi's `settings.json` alone. | `config.ts:211-213` `return overridePath ? resolve(overridePath) : getAgentPath(ADAPTER_CONFIG_NAME);`, `config.ts:680` `const userPath = getPiGlobalConfigPath(overridePath);`, project sources `config.ts:786-819`, argv parse `utils.ts:111-130` [VERIFIED] |
| `MCP_DIRECT_TOOLS=<server>[/<tool>],...` | When set, it **replaces** every entry's `directTools`: `resolveDirectTools` reads only the variable. A server it names gets its tools registered directly (always in the prompt, not deferred). A server it does not name gets no direct or search tools at all, so our `directTools: "search"` and `directTools: true` stop applying. `__none__` selects nothing. The `mcp` proxy tool still reaches every configured server. | `index.ts:376-378`, `direct-tool-surface.ts:83-110` (`if (envSelection) { if (envSelection.servers.has(serverName)) { toolFilter = true; } ... } else { const selected = definition.directTools !== undefined ? definition.directTools : globalDirect; if (selected === "search") { ... lazy = true; } ...`), `metadata-cache.ts:216-236` [VERIFIED]. The proxy reach comes from the adapter README ("One proxy tool") [CITED: pi-mcp-adapter README.md:17,36] |

The adapter's own docs barely name these settings. `docs/configuration.md` mentions `--mcp-config`/`configPath` (lines 65, 85), and `docs/tools.md:183` mentions `MCP_DIRECT_TOOLS` once. Nothing documents `PI_MCP_CONFIG_MODE`. Link to `https://github.com/nicobailon/pi-mcp-adapter/blob/main/docs/configuration.md` (file layout and precedence) and state the effects from the source facts above. [VERIFIED: grep of 5.2.0 docs]

## Live canary design (ADOC-02)

### What was observed live (Pi 1.0.0, adapter 5.2.0, current tree, v0.19.2 seed)

**Capture (D-07-04), sandbox `/var/tmp/mcp4-p7-research/s1`, RPC, extension = 0.19.2 only:**
```text
>>> prompt /claude:plugin marketplace add /var/tmp/mcp4-p7-research/s1/mkt --scope user
NOTIFY[info] ● canary-mkt [user] (added)
>>> prompt /claude:plugin install echo@canary-mkt --scope user
NOTIFY[warning] A plugin operation needs attention.

● canary-mkt [user]
  ● echo v1.0.0 (installed) {requires pi-mcp}

/reload to pick up changes
```
**0.19.2 loads on Pi 1.0.0**, so the D-07-04 stop condition does not trigger. It wrote `agent/mcp.json`:
```json
{ "mcpServers": { "echo": { "command": "node",
  "args": ["/var/tmp/mcp4-p7-research/s1/mkt/plugins/echo/server.mjs"],
  "env": { "CLAUDE_PLUGIN_ROOT": "/var/tmp/mcp4-p7-research/s1/mkt/plugins/echo",
           "CLAUDE_PLUGIN_DATA": "/var/tmp/mcp4-p7-research/s1/agent/pi-claude-marketplace/data/canary-mkt/echo" },
  "_piClaudeMarketplace": { "plugin": "echo", "marketplace": "canary-mkt" } } } }
```
It also wrote `agent/pi-claude-marketplace/state.json` (`"schemaVersion": 2`, the `canary-mkt` marketplace with `"source": {"kind":"path",...}`, `"addedFromCwd"`, `"manifestPath"`, `"marketplaceRoot"`, and plugin `echo` with `"resources": {..., "mcpServers": ["echo"], ...}`) and `agent/claude-plugins.json` (`{"schemaVersion":1,"marketplaces":{"canary-mkt":{"source":"<abs>"}},"plugins":{"echo@canary-mkt":{}}}`). The captured sandbox is kept at `/var/tmp/mcp4-p7-research/s1` for the planner. [VERIFIED: live run]

**Seeded run (paths rewritten s1 → new sandbox), extensions = current tree + adapter 5.2.0 + helper; status taps from the helper's `pi-mcp-adapter/status/v1` listener:**
```text
NOTIFY[warning] <agent>/mcp.json: Ignored settings (details in /mcp-adapter): "echo": _piClaudeMarketplace.
NOTIFY[info] Turned off Pi's built-in MCP so it doesn't run next to pi-mcp-adapter. ...
NOTIFY[info] Plugin MCP servers moved from mcp.json to mcp-adapter.json.

Moved to mcp-adapter.json:
  echo -> plugin_echo_echo_ (echo) [user]
The new names reset what pi-mcp-adapter keeps for each server name: sign in again to servers that use OAuth, and approve project servers again. Until you reload, pi-mcp-adapter can still show the old names.
/reload to pick up changes
info  -> mcp: plugin:echo:echo (not loaded)                 STATUS [["echo","cached"]]
/canary-reload  (reload 1)
NOTIFY[info] MCP: direct tools refreshed (+1, ~0, -0)
info  -> mcp: plugin:echo:echo (cached, connects on first use)   STATUS [["plugin_echo_echo_","cached"]]
/canary-reload  (reload 2: every server lazy, cache valid, no project file = deferred session)
info  -> mcp: plugin:echo:echo (status unknown)              STATUS [] only
```
**Reload count = 1.** After one reload the snapshot lists `plugin_echo_echo_` and no longer lists `echo`. This matches D-05-15. [VERIFIED: live run]

**Route A (fresh process, deferred session), stub script `mcp({search:"echo canary"})` → `mcp__plugin_echo_echo__echo_canary({text:"hi"})`:**
```text
info -> (status unknown)
EVENT tool_execution_end toolName "mcp": "Activated as direct tools: mcp__plugin_echo_echo__echo_canary.\n\nFound 1 tool matching \"echo canary\": ..."
      details.matches[0] = {"server":"plugin_echo_echo_","tool":"mcp__plugin_echo_echo__echo_canary",...}
EVENT tool_execution_end toolName "mcp__plugin_echo_echo__echo_canary": content text "echo-canary:hi", isError false
info -> (connected)
```
**Route B (fresh process), settings `"defaultTools": ["+tool_search"]`, script `tool_search({query:"echo canary"})` → call:**
```text
info -> (status unknown)
EVENT tool_execution_end toolName "tool_search": "Loaded 1 tool. They are available from your next call:\n- mcp__plugin_echo_echo__echo_canary: ...", details.loaded = ["mcp__plugin_echo_echo__echo_canary"]
EVENT tool_execution_end toolName "mcp__plugin_echo_echo__echo_canary": "echo-canary:via-tool-search"
info -> (connected)
```
In both routes the stub log shows `mcp__plugin_echo_echo__echo_canary` absent from the first request's `tools` array and present from the next request on. That proves the deferred tool was declared to the model only after the search. [VERIFIED: live run]

**`--no-extensions` (ROADMAP note), same settings with `+tool_search`, first-request `tools`:**
```text
plain:          [read,bash,edit,write,tool_search,pi_claude_marketplace_list,pi_claude_marketplace_plugin_list,mcp]
--no-extensions:[read,bash,edit,write,pi_claude_marketplace_list,pi_claude_marketplace_plugin_list,mcp]
--no-extensions -e builtin:tool-search: [read,bash,edit,write,tool_search,...,mcp]
```
On Pi 1.0.0, `--no-extensions` **drops** `builtin:tool-search`. Source: `resource-loader.js:403` uses only the CLI paths when `noExtensions` is set, and `package-manager.js:749-751` accepts `-e builtin:<name>`. [VERIFIED: live run + Pi 1.0.0 dist]
**Recommendation (discretion):** fix `scripts/pi.sh` by adding `-e builtin:tool-search` beside the other `-e` flags. This is the smaller correct fix: a one-line change, after which `+tool_search` works in pi.sh sessions as the docs promise. `builtin:mcp` must stay off, because the adapter replaces it.

All probe drivers used are kept at `/var/tmp/mcp4-p7-research/probes/` (`rpc-probe.mjs`, `stub-scripted.mjs`, `canary-reload.ts`, `script*.json`, `c*.json`). The `c*.json` files name sandboxes that were deleted, so rebuild them from `s1`.

### Recommended canary structure

```
tests/live-uat/
├── mcp-adapter-canary.mjs            # new driver (fallow-ignore-file unused-file header)
├── openai-stub-server.mjs            # extended: STUB_SCRIPT replay, default stays "ready"
├── fixtures/mcp-adapter-canary/      # (name at planner's discretion)
│   └── legacy-v0.19.2.json           # captured seed, Prettier-formatted, paths as a placeholder
└── README.md                         # new section + table row; "All four" -> "All five"
```

**Flow (one sandbox, `mkdtemp(path.join(os.tmpdir(), "mcp-adapter-canary-"))`; run with `TMPDIR=/var/tmp/<dir>`):**
1. Preconditions → `human_needed` (exit 1) on failure: `PI_MCP_ADAPTER_ROOT` is set and its `package.json` version is `5.2.0` (D-07-03); Pi resolves through `resolvePiRuntime` with version >= 1.0.0; the realpath of `os.tmpdir()` is outside the repository.
2. Build `home/`, `agent/`, `cwd/`, `mkt/` (the same marketplace and plugin layout as the capture), the stdio MCP server, the helper extension and `agent/models.json` + `agent/settings.json` (stub provider, `"defaultTools": ["+tool_search"]`, `"extensions": ["-builtin:mcp"]`). Seed `agent/mcp.json`, `agent/pi-claude-marketplace/state.json` and `agent/claude-plugins.json` from the fixture, replacing the placeholder with the sandbox root.
3. Start the stub as a child (`STUB_PORT` free, `STUB_SCRIPT` file) or document an operator-started stub, as stop-canary does.
4. RPC session 1 (extensions: repo `index.ts`, `$PI_MCP_ADAPTER_ROOT/index.ts`, helper): wait for the migration notice → assert `echo -> plugin_echo_echo_ (echo) [user]`; info → `(not loaded)`; then `/canary-reload` and info, repeatedly, until info leaves `not loaded` and the status tap lists `plugin_echo_echo_` but not `echo`. Record N (expected 1). Assert `agent/mcp.json` holds no marked entry and `agent/mcp-adapter.json` holds `plugin_echo_echo_` with `"toolPrefix": "mcp"` and `"directTools": "search"`.
5. RPC session 2 (fresh process = deferred session): info → `(status unknown)`; prompt `route-a ...` → assert the `mcp` result `details.matches[].tool` and the echo result text; info → `(connected)`.
6. RPC session 3 (fresh process): info → `(status unknown)`; prompt `route-b ...` → assert `tool_search` `details.loaded` and the echo result; info → `(connected)`.
7. `--no-extensions` probe: one more short session with `--no-extensions` (plus the same `-e` list), and one with `-e builtin:tool-search` added; read the stub log `tools` array. Record both as facts. Do not fail the run on them, because they measure Pi and not this extension.
8. `finally`: kill the stub and every Pi process group, then `rm -rf` the sandbox.

**Negative control (`--invert`, house pattern):** flip exactly one expectation, for example the expected echo text in route A. The run must exit 1 at that assertion after the earlier PASS lines.

**Exit codes:** 0 when everything is proven; 1 for `human_needed` (unmet precondition or inconclusive run); a distinct code for a proven regression is optional (stop-canary uses 2).

### Pattern 1: scripted stub replay (OpenAI chat-completions `tool_calls`)
**What:** a stateless step index, `count(role:"tool" messages after the last role:"user" message)`. The stub picks a script by a marker in the last user message, which lets one stub serve several sessions. With no `STUB_SCRIPT`, it keeps today's behavior: the text `ready`.
**Example (shape verified live against Pi 1.0.0's openai-completions provider, which always sends `stream: true`):**
```js
// Source: prototype at /var/tmp/mcp4-p7-research/probes/stub-scripted.mjs (ran live this session)
const call = { index: 0, id: `call_${idx}`, type: "function",
  function: { name: step.tool, arguments: JSON.stringify(step.arguments) } };
// streaming
res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [call] }, finish_reason: null }] })}\n\n`);
res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }], usage: USAGE })}\n\n`);
res.end("data: [DONE]\n\n");
// non-streaming: message: { role: "assistant", content: null, tool_calls: [ { id, type, function } ] }, finish_reason: "tool_calls"
```
Pi maps `finish_reason: "tool_calls"` to `stopReason: "toolUse"`. [VERIFIED: pi-ai `openai-completions.js:1199-1201`, and Pi sends `stream: true` at line 575]

### Pattern 2: in-sandbox helper extension (reload, wait, status tap)
```ts
// Written by the canary into <sandbox>/helper/canary-helper.ts at run time (ran live as canary-reload.ts)
export default function (pi: any) {
  pi.registerCommand("canary-reload", { description: "reload", handler: async (_a: string, ctx: any) => { await ctx.reload(); } });
  pi.registerCommand("canary-wait", { description: "wait ms", handler: async (a: string) => { await new Promise((r) => setTimeout(r, Number(a.trim() || "3000"))); } });
  pi.events.on("pi-mcp-adapter/status/v1", (s: any) => { /* record [name,status] pairs; expose via a notify command or stderr */ });
}
```
`ExtensionCommandContext.reload(): Promise<void>` exists on Pi 1.0.0 (`core/extensions/types.d.ts:321-322`), and RPC binds it (`modes/rpc/rpc-mode.js:252-254`). [VERIFIED] RPC does not handle `/reload` itself: `agent-session.js:1490-1491` tries only extension commands, so a builtin slash command goes to the model as text.

### Pattern 3: RPC step loop with events
Copy `tests/e2e/_rpc.ts`: an allowlisted env (`HOME`, `PI_CODING_AGENT_DIR`, `PI_OFFLINE=1`, `PATH`), `--mode rpc --offline --no-session`, `detached: true` with a process-group SIGKILL on exit or hard stop, dialogs answered `cancelled: true`, and notifies taken from `extension_ui_request` with `method: "notify"`. Add three things: (a) collect `tool_execution_end` events (`toolName`, `result.content[].text`, `result.details`, `isError`); (b) for a model prompt, advance on the `agent_settled` event, not on the `response`, which arrives at preflight; (c) wait steps, because startup notifies such as the migration notice arrive asynchronously.

### Pattern 4: dependency-free stdio MCP server (ran live with adapter 5.2.0)
```js
import { createInterface } from "node:readline";
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
createInterface({ input: process.stdin }).on("line", (line) => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id === undefined) return;                       // notifications/initialized etc.
  switch (m.method) {
    case "initialize": send({ jsonrpc: "2.0", id: m.id, result: { protocolVersion: m.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "echo-canary", version: "1.0.0" } } }); break;
    case "tools/list": send({ jsonrpc: "2.0", id: m.id, result: { tools: [{ name: "echo_canary", description: "Echo canary: returns the text it is given.", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } }] } }); break;
    case "tools/call": send({ jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: `echo-canary:${m.params?.arguments?.text ?? ""}` }] } }); break;
    case "ping": send({ jsonrpc: "2.0", id: m.id, result: {} }); break;
    default: send({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "method not found" } });
  }
});
```
Plugin manifest used: `{"name":"echo","version":"1.0.0","mcpServers":{"echo":{"command":"node","args":["${CLAUDE_PLUGIN_ROOT}/server.mjs"]}}}`.

### Seed fixture format (recommendation)
A JSON file cannot hold a header comment, so wrap the three captured files: `{ "$comment": "...", "capturedWith": "pi-claude-marketplace@0.19.2 on @earendil-works/pi-coding-agent 1.0.0, <date>", "captureCommand": "...", "sandboxRoot": "@@SANDBOX@@", "files": { "mcp.json": {...}, "pi-claude-marketplace/state.json": {...}, "claude-plugins.json": {...} } }`. Every absolute path in the capture begins with the capture sandbox root, so one string replacement re-roots it (verified: an `s1` → `s2`/`s3` rewrite migrated correctly). Seed `claude-plugins.json` too, because reconcile diffs the declared config against the records. Record the capture steps in the README. A `--capture-legacy <v0.19.2 prefix>` mode in the canary is the most reproducible route, and it reuses the same marketplace builder. The fixture must hold no `/home/<user>` path, which the placeholder ensures.

### Anti-Patterns to Avoid
- **One turn for both search routes:** `tool_search` after `mcp({ search })` returns `No matching tools found.`, because the tool is already active and `tool_search` "searches tools that are not declared to the model". Run the routes in separate fresh sessions, or run `tool_search` first. [VERIFIED: live run; Pi `extensions/tool-search/tool.js` header]
- **Sandbox inside the repository:** `_rpc.ts` refuses that location ("Pi asks for project trust in every directory under the repository"). Use `os.tmpdir()` with `TMPDIR=/var/tmp/...`, not `tmp/pi-uat`.
- **Asserting info right after `/canary-reload` with no wait:** the adapter starts in the background after `session_start`, and the probe saw `status unknown` / no cache write when steps ran back to back. Wait or poll.
- **Importing the extension in-process** for the seed or install: not needed. The seed comes from the fixture, and everything else goes through the real Pi child, which keeps the canary hermetic.
- **Reading the canary's exit through a pipe** (`| tail`): this reports the pipe's status (memory note).

## Docs gap inventory (ADOC-01)

### `docs/mcp-compatibility.md`
| Line | Stale or missing | Fix |
|------|------------------|-----|
| 7 | `pi-mcp-adapter 5.0.0 on Pi 1.0.0` as the Pi column's basis | Name 5.2.0 and the canary run date. Keep the 2026-10-06 measurement as history. |
| 9 | Says only that entries go into `mcp-adapter.json` | Add that older releases wrote `mcp.json` and that `/reload` moves those entries (link Upgrading). |
| 33-35, 41-51 | Correct. `tool_search` "off by default" is still true. | Add that `scripts/pi.sh` (if documented) and `--no-extensions` drop `tool_search` unless `-e builtin:tool-search` is passed (observed). |
| 34, 39 | Covers server `alwaysLoad` only | Add per-tool `_meta["anthropic/alwaysLoad"]` as a documented divergence (E1, Pi capability gap). |
| 70 | "the adapter starts each server when Pi starts, reads the list of its tools, and then stops it" | **Partly stale.** That happens only when the adapter has no valid cached tool list. In a deferred session (cache valid, all servers lazy, no project-file servers) the adapter starts no server until first use (observed: `STATUS []` only, then `cached`/`connected` after use). |
| 226 | `pi-mcp-adapter 5.1.0`, `>=5.1.0 <6` | → 5.2.0 |
| 228-249 | One flat list | D-07-13: regroup under naming / loading / variables / migration / status subheadings, keep each bullet, and add the new items. |
| — (missing) | No "Upgrading" section | D-07-09. Include the adapter's one-time warning seen on the first start after upgrading, before the move: `<agent dir>/mcp.json: Ignored settings (details in /mcp-adapter): "<name>": _piClaudeMarketplace.` (observed live, adapter 5.2.0; `config.ts` unchanged from 5.1.0). The old names stay live until the next `/reload`. Info shows `not loaded` in the migration session (observed). |
| — (missing) | No "Server status in info" section | D-07-12 tokens. Cite catalog anchors such as `output-catalog.md#partially-installed----each-mcp-servers-state-astat-01` (verify the slugs with mdformat/markdownlint). |
| — (missing) | No adapter-settings section | D-07-08 text from the verified table above. |
| — (missing) | No project-approval text | E2 / D-07-06: a project-scope plugin's servers prompt at install and after each update; headless sessions skip unapproved ones. |
| — (missing) | GHSA side effect | A server URL that redirects to another host is no longer followed. |

### `docs/env-vars.md` (ENVDOC-01)
| Line | Stale claim | Current behavior (source) |
|------|-------------|---------------------------|
| 3 | "verified against the Claude Code v2.1.212 binary" | MCP rules now follow 2.1.291 (mcp-compatibility.md line 7). |
| 9 | MCP "deep-substitutes ... across every string value at any nesting depth", "A token whose value is absent passes through literally" | Five fields only (stdio `command`, `args`, `env` values; remote `url`, `headers`). `oauth`, `description` and keys stay literal. `${VAR:-default}` resolves at install; plain `${VAR}` is kept for the adapter. [VERIFIED: substitute.ts header lines 3-14] |
| 11 | E list omits `CLAUDE_PROJECT_DIR` and `PI_CLAUDE_MARKETPLACE_EMPTY` | `applyMcpAdapterEnv` sets `PI_CLAUDE_MARKETPLACE_EMPTY=""` and `CLAUDE_PROJECT_DIR=<cwd>` on Pi's process at load and every `session_start`; "Bash and MCP children inherit both values." [VERIFIED: shared/session-env.ts:9-11, 82, 103-121] |
| 13, 24 (`I†`), 122 | `CLAUDE_PROJECT_DIR` injected into the stdio `env` for project scope | **Not injected at any scope.** `withInjectedEnv` injects only `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA`; "MENV-03 is satisfied by inheritance". [VERIFIED: bridges/mcp/substitute.ts:151-168] |
| 24 (Bash `--†`), 33 (†), 52 | "Pi sets none in bash children" | Bash children now inherit `CLAUDE_PROJECT_DIR` (divergence already in mcp-compatibility.md:240). |
| 104-112 | "MCP config substitution ... whole-entry and deep" | Replace with the five-field rule plus the escapes (split token, `!!`, leading `~` → partial). |
| 149-154 | "verified against 2.10.0", interpolation "not to `command` or `args`" | The adapter 5 interpolates `command`/`args` and expands a leading `~` (research FEATURES A6), and runs a leading `!` as a command. Re-anchor to 5.2.0 and point to mcp-compatibility "Variables". |
| 156-158, 172 | "User-scope `${CLAUDE_PROJECT_DIR}` pass-through" (MCP part) | Content (skills/commands/agents) is still literal at user scope (SUB-02). MCP: a user-scope entry keeps `${CLAUDE_PROJECT_DIR}` and the adapter expands it from Pi's process; skipped when the cwd holds or ends in a marker. |
| — (missing) | `PI_CLAUDE_MARKETPLACE_EMPTY` row; withheld credentials; `AI_AGENT=pi` row (ENVDOC-01 point 2) | Pi 1.0.0 still sets `process.env.AI_AGENT = "pi"` (`dist/rpc-entry.js:7`). [VERIFIED: grep] |

### `docs/hooks-compatibility.md`
The research claim from PITFALLS (line 206) that the hooks doc said matchers match MCP tools "under the adapter" was already scoped by the shipped ANAME-02 text at lines 108-110. Remaining touch-ups:
- Lines 82-83 (`MCP literal` / `MCP server prefix` rows, ✓): add the qualification that these match **plugin** MCP tools by their Claude names, and direct calls only. Servers the user configures in the adapter use the adapter's own naming (`toolPrefix` default `"server"` → `<server>_<tool>`) [VERIFIED: 5.2.0 types.ts:904-907], so a `mcp__<server>__<tool>` matcher does not match them.
- Line 31/64 Elicitation "blocked on pi-mcp-adapter exposing the relevant MCP request": still true in 5.2.0. The adapter emits only status, runtime-register/snapshot, protocol and tool-approval events. [VERIFIED: grep `events.emit` in 5.2.0] No change.
- Line 204 `CLAUDE_PROJECT_DIR` ✓: still correct for hooks.

### README.md / README.es.md
| Line | Change |
|------|--------|
| 40 / 40 | `5.1.0` → `5.2.0` (with the Spanish equivalent) |
| 29 or 122-130 | One linking sentence to "Upgrading" (rename costs) and/or "Server status in info". D-07-12 says "one linking sentence" per README. Decide whether that means one total or one per topic. The existing pattern is one sentence per topic ending in "see [MCP compatibility](docs/mcp-compatibility.md)". |
| 333 ("Show details for one plugin.") | A natural place for the status sentence. |

### `docs/prd/pi-claude-marketplace-prd.md` (D-07-14, every MCP mention)
| Line | Stale text |
|------|-----------|
| 143, 154 | Overview diagram `ext --> mcpFile[(scope/mcp.json)]`, `mcpFile -. discovers .-> mcpAdapter` |
| 167 | `` `<scope>/mcp.json` (entries marked with `_piClaudeMarketplace: { plugin, marketplace }`). `` |
| 225 (MU-9), 265 (PI-12), 483 (MC-8) | The "`pi-mcp-adapter is not loaded; install/load it (npm:pi-mcp-adapter) and run /reload ...`" message **no longer exists in source** (grep of `extensions/` is empty). ADET-01 replaced it with `{requires pi-mcp-adapter}` and the info `requires:` line. |
| 472-498 (5.8) | No rows for naming (ANAME), translation/partial (ANAME-07), variables (AVAR), migration (AMIG), status (ASTAT). The flowchart ends in `stageMcpServers with marker`. |
| 530 (SC-2), 1047 (NFR-10) | **Already updated** (`mcp-adapter.json`; `mcp.json` "kept for legacy entries"). Only the wording "until the migration window closes" may be added. |
| 721-742 (7.2) | `MCP servers merged into scope/mcp.json`, `Message names "pi-mcp-adapter is not loaded …"` |
| 804-826 (7.6) | `writes scoped mcp.json directly`, `Stale MCP entries pruned at next mcp.json read` (not named in D-07-14, but "every MCP mention" covers it) |
| 864-911 (8.3/8.4) | State names `StagingMcp` and so on are still valid. Check the labels only. |
| 963, 993-996 (9.1) | `mcp/` module subgraph: check it against the current `bridges/mcp/` files. |
| 1015 (9.2) | `└── mcp.json # pi-mcp-adapter reads here (NOT extensionRoot)` → `mcp-adapter.json` (+ legacy `mcp.json`) |
| 1125 (App. B) | `MCP server | server name verbatim from declaration | none (_piClaudeMarketplace marker added)` → `plugin_<plugin>_<server>_` |

### `docs/output-catalog.md`
Only line 2607 (the version) changes. Its `not loaded` prose already covers "a plugin installed in this session that the adapter has not read yet". The live run shows the same token for an entry moved in this session. Planner's discretion whether to add that sentence; the catalog is a build input that `catalog-contract` parses.

### `tests/live-uat/README.md`
Lines 5-12: the table gets a fifth row, and "All four follow the same honesty contract" becomes five. Line 301 (the stub description) gains the `STUB_SCRIPT` mode.

## CHANGELOG inventory (ADOC-03)

Present under `[Unreleased]` (from main, keep as is): the partial-availability bullet (#246), `no-await-in-loop` (#238), **the Node floor bullet (#234, #236)**, the any-git-host bullets (#221), `new-gsd-milestone` (#229), the hook pipe-matcher bullet (#219), workflows (#205, which still says "Pi Coding Agent 0.86.1 is now required"), dependencies (#198), and the GSD research skill (#210). Present from mcp-4: only `CHANGELOG.md:5`, the 5.1.0 bullet. [VERIFIED: CHANGELOG.md:1-60]

Missing mcp-4 user-visible changes, from `git log main..HEAD` feat/fix commits:
- Pi 1.0 floor (`175b61e2`) and the companion floors pi-subagents `>=0.74.0` (PIFL-02) and engine pins. Node is already covered.
- The adapter 5.2.0 floor + GHSA-6qxp-vccf-f47h + the redirect side effect (replaces line 5).
- Delivery to `mcp-adapter.json` (`341db258`) with sub-bullets: Claude Code tool names (`07c96f65`, `fb0b06b5`, `8b710fe4` agent `tools:` mapping, `f163778f` hook prefix matchers); tool search via `directTools: "search"`; the closed field translation (`94775201`); key-collision refusal (`346dd7dc`) and nine-source collisions (`6bded229`); `{unsupported mcp}` partial installs (`a623ffab`, `00000855`); variable rules, unset-variable warnings and withheld credentials (`0f4d7a8e`, `e29c6624`, `ad182607`, `a8c82627`); permission-rule warnings (`2bbce472`); user overrides kept across updates (`3ebe01dc`, `21fc8a88`); the JSONC comment-drop warning (`927ce1b9`); the legacy `mcp-servers` key (AFILE-03); the automatic move on `/reload` (`f5686c61`, `e878f8cd`, `6d56547e`).
- Adapter detection: Pi's built-in MCP does not count, and the marker is `{requires pi-mcp-adapter}` (was `{requires pi-mcp}`) (`9d1c8a36`, `d651d6b9`, `d1e24ebd`); the info `requires:` line (`2502cbf3`).
- Status in info (`fd9c887b`, `51f87c13`), plus `unset`/`withheld` in info (`b645d820`).
- Action needed after upgrading (link to Upgrading).
- `Internal:` — `scripts/pi.sh` keeps off the real Pi home (`cd50c39b`) and the `builtin:tool-search` fix if taken; CI conformance tests against the adapter (`f9bf9a0a`); the canary.

## Version-bump touch points (offer 0.20.0, do not bump in the phase)

| File | Current (verbatim) |
|------|--------------------|
| `package.json:110` | `"version": "0.19.2"` |
| `package-lock.json:3,9` | `"version": "0.19.2",` (twice: top level and `packages[""]`) |
| `extensions/pi-claude-marketplace/shared/extension-version.ts:14` | `export const EXTENSION_VERSION = "0.19.2";` |
| `sonar-project.properties:7` | `sonar.projectVersion=0.19.2` [VERIFIED: sonar-project.properties:7] |
| `CHANGELOG.md:3` | `## [Unreleased]` → `## [0.20.0] - <date>` (format of `CHANGELOG.md:72` `## [0.19.2] - 2026-09-24`) |

`tests/architecture/extension-version-sync.test.ts` asserts `EXTENSION_VERSION` equals `package.json` `version` (BFILL-02). Use `npm version minor --no-git-tag-version` for package.json + lock (memory: version-bump checklist).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resolving Pi's CLI | `which pi`, a hard-coded path | `resolvePiRuntime(REPO_ROOT)` from `tests/pi-runtime.ts` | House rule: never a `pi` on PATH |
| Driving `/reload` | sending `/reload` as a prompt | helper command calling `ctx.reload()` | RPC has no builtin `/reload` |
| Observing adapter state | parsing adapter logs or cache files | `pi-mcp-adapter/status/v1` tap in the helper, plus info output | The same channel info reads (ASTAT-01) |
| Lock update | hand-editing `package-lock.json` | `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` | Matches the previous floor raise |
| Version bump | separate edits | `npm version minor --no-git-tag-version` + EXTENSION_VERSION + sonar | Lockstep test |

## Common Pitfalls

### Pitfall 1: Same-turn search routes
**What goes wrong:** the D-07-01 list run in one turn (`mcp({search})` → `tool_search` → call) shows `tool_search` returning `No matching tools found.`.
**Why:** `mcp({ search })` activates the match, and `tool_search` searches only inactive deferred or codemode tools.
**How to avoid:** use two scripts in two fresh RPC processes, or put `tool_search` first. The D-07-01 assertion (both routes return `mcp__plugin_<p>_<s>__<tool>`) still holds.
**Warning signs:** a `tool_search` `details.loaded` that is `[]`.

### Pitfall 2: No deferred session on the first reload after the move
**What goes wrong:** the canary expects `status unknown` right after the migration reload, but sees `cached, connects on first use`.
**Why:** the first load of the new key has no valid metadata cache, so the adapter connects to bootstrap it and publishes `cached`. A deferred session needs every enabled server lazy, a valid cache and no project-file servers (`index.ts:751-773` `getDeferredSessionSnapshot`).
**How to avoid:** check the deferred `status unknown` in a later session (reload 2 or a fresh process). Keep the canary user-scope only.

### Pitfall 3: Timing
**What goes wrong:** startup notifies (the migration notice) and adapter snapshots arrive after the first RPC step, and an info call right after a reload sees an older state.
**How to avoid:** wait or poll steps with a bounded timeout. Associate notifies with the step in flight, as `_rpc.ts` does with `after`.

### Pitfall 4: `_rpc.ts` reuse
`_rpc.ts` refuses sandboxes inside the repository and outside `os.tmpdir()`, collects no tool events and cannot reload. The live-uat convention of `tmp/pi-uat` would put the RPC cwd inside the repository, where Pi prompts for project trust. Build a self-contained `.mjs` driver that copies its patterns. The canary may import `../pi-runtime.ts`, as stop-canary does.

### Pitfall 5: Stale gate counts and citations
- `tests/architecture/no-stale-test-citations.test.ts` polices `.md`/`.mjs`/`.ts` under `tests/`: every `tests/...` path that the new README section or canary comments cite must exist. A path that is the whole content of a quoted string literal in `.mjs` is exempt.
- Committing any non-`.test.ts` file under `tests/` (canary, stub, fixture) makes the pre-commit hook run all source-test pairs. Commit in the foreground with the longest timeout.
- `.planning/codebase/CONVENTIONS.md` says "exactly 18" `fallow-ignore` markers. There are already 19 (`rg -n "fallow-ignore" extensions tests scripts | wc -l`), and the canary adds one.

### Pitfall 6: Conformance root after the raise
After `package.json` moves to `>=5.2.0 <6`, `PI_MCP_ADAPTER_ROOT` pointing at the old 5.1.0 scratch (`/var/tmp/mcp4-p4-08/...`) **throws** ("outside the declared peer range") by design. Use the 5.2.0 scratch at `/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| adapter floor 5.1.0 (SDK client 2.0.0) | 5.2.0 (SDK 2.3.1) | 2026-10-09 | Fixes GHSA-6qxp-vccf-f47h; cross-host redirects are no longer followed |
| `--mcp-config` run writes `-builtin:mcp` | it no longer writes it | 5.2.0 | Affects only one-off runs; pi.sh is unaffected |
| `mcp({ server })` lists names only | lists parameter names | 5.2.0 | Not used by our assertions |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The adapter's `mcp` proxy tool still reaches servers that `MCP_DIRECT_TOOLS` does not name | D-07-08 table | Doc wording only. Phrase it as "through the `mcp` tool" or verify with one probe. |
| A2 | "Headless sessions skip unapproved project servers" (E2, from CONTEXT/FEATURES A11) | Docs gap | Not re-probed this session. The text comes from prior research. |
| A3 | A placeholder-substituted seed behaves the same as an in-place capture in every case | Seed fixture | Verified for one path-source plugin. Git-source plugins were not tried (not needed). |
| A4 | Operator acceptance of D-07-07 satisfies the package-legitimacy human-verify checkpoint for adapter 5.2.0 | Package audit | If not, add one checkpoint before the first scratch install. |

## Open Questions

1. **D-07-01's single list vs Pitfall 1.** What we know: one turn cannot prove `tool_search` after `mcp({ search })`. Recommendation: two scripts (route A, route B) in separate sessions. This keeps the locked intent: both routes, a stub, no real model.
2. **One linking sentence per README, or one per topic (Upgrading, status)?** D-07-12 says "one linking sentence". The planner picks; the existing pattern is one per topic.
3. **Whether the canary should also prove a fresh install path** (`/claude:plugin install` of a second MCP plugin through RPC). ADOC-02 does not require it. It is cheap and proves "the adapter loads our entries" beyond migrated ones.
4. **Exit code for a proven regression** (stop-canary uses 2). The planner's choice.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v26.11.0 local (CI uses 24) | — |
| npm | scratch installs, lock | ✓ | 11.20.0 | — |
| Repository Pi | canary | ✓ | 1.0.0 (`node_modules`) | — |
| pi-mcp-adapter 5.2.0 scratch | canary, conformance | ✓ | `/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter` (kept for reuse) | reinstall with the command above |
| pi-claude-marketplace 0.19.2 scratch | one-time capture | ✓ | `/var/tmp/mcp4-p7-research/v0192/...` (kept) | reinstall |
| Captured legacy sandbox | fixture authoring | ✓ | `/var/tmp/mcp4-p7-research/s1` (kept) | re-capture |
| `/var/tmp` space | scratch | ✓ | 168G free, 2% inodes | — |
| `/tmp` | — | tmpfs at 77% inodes | — | always set `TMPDIR=/var/tmp/<dir>` |
| Network (npm registry) | scratch installs only | ✓ | — | The canary itself runs offline (`--offline`, `PI_OFFLINE=1`, stub on 127.0.0.1) |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in) |
| Config file | none. Scripts are in `package.json`. |
| Quick run command | `node --test tests/architecture/peer-floor.test.ts tests/bridges/mcp/adapter-entry.test.ts` |
| Full suite command | `npm run check` (gate). Integration with the real peer: `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter TMPDIR=/var/tmp/<dir> npm run test:integration` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-07-07 (PIFL-03 amend) | range `>=5.2.0 <6`, lock mirrors it, not a lock package | unit/arch | `node --test tests/architecture/peer-floor.test.ts` | ✅ (edit) |
| D-07-07 | vendored ServerEntry pin tracks the floor | unit | `node --test tests/bridges/mcp/adapter-entry.test.ts` | ✅ (edit) |
| D-07-07 | expansion + status conformance against 5.2.0 | integration | `PI_MCP_ADAPTER_ROOT=<5.2.0> TMPDIR=/var/tmp/<dir> node --test tests/integration/adapter-expansion-conformance.test.ts tests/integration/mcp-status-conformance.test.ts` | ✅ (no edit; 55/55 this session) |
| ADOC-02 | adapter loads entries, migration + reload count, both search routes, info unknown→live | live UAT (operator-run) | `PI_MCP_ADAPTER_ROOT=<5.2.0> TMPDIR=/var/tmp/<dir> node tests/live-uat/mcp-adapter-canary.mjs; echo "EXIT=$?"` (no pipe) + `--invert` control expecting exit 1 | ❌ Wave 0/1 |
| ADOC-01 | docs accurate | manual review + `SKIP=npm-check pre-commit run --files <docs>` (mdformat, markdownlint) | — | n/a |
| ADOC-01 | catalog edit still parses | arch | `node --test tests/architecture/catalog-uat/*.test.ts` | ✅ |
| ADOC-03 | CHANGELOG bullets present, bump offered | manual (`grep -n "5.2.0\|mcp-adapter.json" CHANGELOG.md`) | — | n/a |

### Sampling Rate
- **Per task commit:** the pre-commit hook (`check:commit`) for build inputs. Docs-only commits skip it.
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` green, plus the canary PASS transcript and the `--invert` exit 1 pasted into `tests/live-uat/README.md` "Observed result".

### Wave 0 Gaps
- [ ] `tests/live-uat/mcp-adapter-canary.mjs`: covers ADOC-02
- [ ] the seed fixture JSON (captured from 0.19.2): covers ADOC-02's legacy migration
- [ ] `openai-stub-server.mjs` `STUB_SCRIPT` mode: covers D-07-01

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (the canary uses no OAuth) | — |
| V5 Input Validation | low | The stub parses JSON defensively, as today |
| V6 Cryptography | no | — |
| V10 Malicious code / V14 Configuration (dependency) | **yes** | The floor raise to 5.2.0 removes GHSA-6qxp-vccf-f47h from the supported range. Scratch installs stay outside the repository; `--ignore-scripts` for the adapter. |
| V8 Data protection | yes | The committed fixture holds no `/home/<user>` path or secret (placeholder root). The stub never logs headers. |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| The canary writes into the real `~/.pi/agent` | Tampering | Allowlisted child env with explicit `HOME` and `PI_CODING_AGENT_DIR` under a `mkdtemp` sandbox; refuse a tmpdir inside the repository; never import the extension in-process |
| A provider key leaks to the stub or a real provider | Information disclosure | Allowlisted env (no inherited keys); `apiKey: "stub"`; loopback-only stub; headers never logged |
| A malicious MCP server collects saved OAuth tokens (GHSA-6qxp-vccf-f47h) | Information disclosure | Peer floor `>=5.2.0 <6` |
| An orphaned stub or MCP server process | DoS | Process-group SIGKILL on exit and hard stop; stub killed in `finally` |
| The fixture captures a developer's paths or tokens | Information disclosure | Placeholder substitution; review the fixture before commit |

## Sources

### Primary (HIGH confidence)
- pi-mcp-adapter 5.2.0 npm tarball (scratch install): `CHANGELOG.md`, `config.ts:211-213,679-695,786-819,890-892`, `index.ts:376-378,392-393,436-460,751-773,1342-1400`, `direct-tool-surface.ts:72-110`, `metadata-cache.ts:216-267`, `utils.ts:111-130`, `types.ts:18,890-907`, `docs/configuration.md`
- pi-mcp-adapter 5.1.0 scratch (`/var/tmp/mcp4-p4-08`) for `diff -rq`
- `@earendil-works/pi-coding-agent` 1.0.0 dist: `extensions/index.js`, `extensions/tool-search/{index,tool}.js`, `core/resource-loader.js:403,500`, `core/package-manager.js:737-756`, `core/agent-session.js:1490,2899-2931`, `modes/rpc/rpc-mode.js:225-300`, `core/extensions/types.d.ts:286-323`, pi-ai `api/openai-completions.js`
- Live RPC runs this session (capture, migration, reloads, both search routes, `--no-extensions`)
- Repository files read this session: `package.json`, `scripts/pi.sh`, `.github/workflows/ci.yml`, `tests/architecture/peer-floor.test.ts`, `tests/bridges/mcp/adapter-entry.test.ts`, `platform/mcp-status.ts`, `shared/session-env.ts`, `bridges/mcp/substitute.ts`, docs listed in the inventory, `CHANGELOG.md`, `tests/e2e/_rpc.ts`, `tests/live-uat/*`

### Secondary (MEDIUM confidence)
- github.com/advisories/GHSA-6qxp-vccf-f47h (fetched; title, affected and patched versions)

### Tertiary (LOW confidence)
- none

## Metadata

**Confidence breakdown:**
- Standard stack / floor raise: HIGH. Diffed and tested against the real 5.2.0.
- Canary architecture: HIGH. The whole flow ran live.
- Docs inventory: HIGH for the cited lines. The PRD diagram review (8.x/9.1) is MEDIUM, because labels were skimmed, not reconciled line by line.

**Research date:** 2026-10-09
**Valid until:** 2026-10-23 (the adapter released 5.0→5.2 in 8 days; re-check `npm view pi-mcp-adapter dist-tags` before the canary run)
