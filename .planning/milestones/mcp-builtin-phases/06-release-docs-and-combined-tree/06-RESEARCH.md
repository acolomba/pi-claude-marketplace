# Phase 6: Release Docs and Combined Tree - Research

**Researched:** 2026-11-04
**Domain:** release docs, closed-set and fallow cleanup, parent-line code changes, combined-tree gate (TypeScript Pi extension, cucumber dual profile)
**Confidence:** HIGH (every in-repo claim was read this session; Pi 1.5.0 and pi-mcp-adapter 7.0.0 claims cite their installed source)

## Summary

The combined tree (`2e125e0`, merge `a25cd35`) already carries most of what Phase 6 must document. Phases 2 to 5 wrote the built-in text into `docs/mcp-compatibility.md` and `docs/hooks-compatibility.md`. What is missing: the CHANGELOG, both READMEs, the Phase 4 agents text in `docs/mcp-compatibility.md`, the frozen catalog lines in `docs/output-catalog.md` and `docs/json-output.md`, and every record (PROJECT.md, BACKLOG.md, the codebase maps, the cucumber skill, the root dubious-choices log).

Three findings change the plan. **First, D-P6-07 removes nothing.** All six candidate closed-set entries have a production emitter and a scenario that observes them, so the lock counts, `docs/json-output.md` token lists, and the wire schema stay as they are. **Second, D-P6-08 needs less code than CONTEXT expects.** With both frozen `entry` lines and the whole `ignoreExports` block removed, `fallow dead-code` reports only `LegacyServersUnreadableError` and `LegacyServersUnreadableReason`. `StoredMcpCompatibility` and `LegacyServers` count as used through exported signatures. **Third, the DUAL-04 read is `/claude:plugin list`.** It is the only surface that shows the `{requires mcp}` marker for an installed plugin (`info` shows `requires: mcp (missing)` with empty reasons). The red proof runs in a git worktree at `d1711fd`, which has the switch scenario but not Phase 3.

Several parent lines are larger than one line: P3-DC-22 (completions per implementation, user-visible on Tab), UF-1 (a containment check the legacy reader cannot do without `ScopedLocations`), and the `piMcpAdapterLoaded` removal (217 occurrences in 34 code and test files). Some are already applied and must not be redone: P1-DC-33, the `verdict-markers.feature` built-in text, `info.test.ts` `plugin_alpha_srv`, REQUIREMENTS traceability for Phase 2's 11 IDs, the 03-06 `PluginConvergeTarget` field, and `companion-missing.feature:76`, which is moot now.

**Primary recommendation:** run seven disjoint plans in wave 1: the switch row, the grant repoint, completions, the small test and harness lines, the stand-in wait, the README and compat docs, and the catalog docs. Then wave 2: UF-1, UF-4, and the fallow and export cleanup. Then wave 3: the `piMcpAdapterLoaded` removal, alongside two records plans. Then wave 4: one serial combined-tree gate that writes the CI handoff.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `{requires mcp}` marker on a list row | orchestrators (`list-installed-row.ts`, `shared/concerns/soft-dep.ts`) | shared (notification grammar) | Marker computed from record + run snapshot (`mcpDependencyMarker`, soft-dep.ts:182-192) |
| Switch scenario (DUAL-04) | features harness (restart steps, world) | Pi process | Observes Pi through RPC; restarts change companions/settings only |
| Agent grant form on update/converge | orchestrators/plugin/update-swap.ts | bridges/agents | `updateAgentImplementation` picks the form; bridge renders it |
| Completion statuses per implementation | edge/register.ts + orchestrators/edge-deps.ts | shared/completion-cache.ts | Edge reads snapshot per lookup; classifier computes; cache keys |
| Legacy reader containment (UF-1) | orchestrators/mcp/recorded-servers.ts | shared/path-safety.ts | NFR-10 chokepoint `assertPathInside` |
| Release docs | docs/, README*, CHANGELOG | test/architecture/catalog-uat (byte contract) | Catalog blocks are byte contracts |
| Records | .planning/* | — | Parent-only files |

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Never commit to `main`; work on `features/mcp-builtin`; merge, never rebase; commit per `.agents/skills/committing/SKILL.md`; never `--no-verify`. Commit titles carry no milestone/phase/plan ID (ROADMAP milestone rules).
- Every plan `SUMMARY.md` has `## Threat Flags` (even "None").
- `gsd-tools windows append --description` is prefixed `[mcp-builtin]`; never hand-edit `.planning/WINDOWS.md`. Close an entry with `gsd-tools windows fixed <id>` or `waive <id> <reason>` (subcommands verified: `status, append, waive, fixed`).
- A user-visible `/claude:plugin` change ships a cucumber scenario that fails without it (AGENTS.md "Behavioral tests"), with the red proof per profile (ROADMAP milestone rules).
- Upstream parity is the default; a divergence needs a recorded decision ID or a Pi gap.
- `npm run check` must stay green (typecheck, ESLint, fallow incl. dupes/health/rule-pack, Prettier, pairing, unpaired tests, integration, both cucumber profiles, 100% direct coverage per pair). GSD gates run `npm run check` on the combined tree; a passing hook is not a gate verdict.
- README changes: `simple-english` Plain + `humanizer`; README.md and README.es.md change in the same commit (`.agents/skills/readme/SKILL.md`).
- CHANGELOG: one top-level bullet per PR, sub-bullets two-space indented, ≤40 words per bullet, ≤25 words per sentence, no `should/would/could/may`, no semicolon, no dash between statements, PR number on the top line only; run `pre-commit run --files CHANGELOG.md` (`.agents/skills/changelog/rules/entries.md`).
- Unit tests: "Do not export a symbol for a test" (`.agents/skills/typescript-unit-tests/rules/pairing-and-design.md:30`).
- Frozen exports: never a `fallow-ignore` source marker in a frozen file; `ignoreExports` entries are removed by the consuming phase (CONVENTIONS.md:62).
- Comments and test titles cite durable IDs (D-NN, NFR-N), not Phase/Plan/Wave.
- Output only through `shared/notification-dispatch.ts`; no stdout/stderr.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Release documentation (MDOC-02)

- **D-P6-01:** `CHANGELOG.md` gets one lead bullet under `[Unreleased]` for
  the milestone pull request, with sub-bullets, in the shape of the 0.22.0
  entry (#295). The existing "Pi 1.5.0 or newer" bullet folds into it
  (P1-DC-27). The sub-bullets come from the parent lines of Phases 1-5,
  rewritten per the `changelog` skill (simple-english Plain plus humanizer,
  40 words or fewer each). The PR number is added when the PR exists. That
  is not in this phase.
- **D-P6-02:** `README.md` and `README.es.md` change together per the `readme`
  skill. The MCP text says three things:
  - Pi's built-in MCP serves plugin MCP servers without pi-mcp-adapter.
  - To use plugin MCP servers, turn on built-in MCP or install pi-mcp-adapter.
  - When both are loaded, the adapter is the one that runs.

  It also lists what the adapter adds over built-in, taken from
  `docs/mcp-compatibility.md` (each item cites a scenario or the Pi source),
  and the three `requires` markers (D-MB-07).
- **D-P6-03:** `docs/hooks-compatibility.md` describes two things:
  - the built-in tool-name divergence. Pi folds `-` to `_` in the tool
    segment, a hook matcher sees Claude's server segment, and long names are
    cut to 55 characters plus a hash (D-MB-08, D-MB-13).
  - the proxy-call rule, which now applies only under pi-mcp-adapter.
- **D-P6-04:** Each change to `docs/output-catalog.md` or `docs/json-output.md`
  (lines 69, 3041, 3161, 3176-3188; 723, 766) lands in the same commit as the
  matching literal in `test/architecture/catalog-uat/fixtures/plugin-info.ts`.
  `npm run test:unpaired` must pass on that commit.

### Switch scenario (DUAL-04)

- **D-P6-05:** DUAL-04 extends the existing `@own-implementation` scenario "A
  plugin's server moves from pi-mcp-adapter to pi's built-in mcp and back with
  no plugin command" in `features/mcp-server/implementation-switch.feature`.
  No new scenario is added. Right after "the user restarts pi without
  pi-mcp-adapter", while built-in MCP is still off, the scenario reads the
  plugin's state through the user surface and expects `{requires mcp}`. The
  existing read steps are `/claude:plugin list` or `info`, whichever already
  shows the marker under Phase 3's rows. The scenario keeps its other steps
  and adds no plugin command between restarts. The red proof: the new row
  fails on a tree that does not emit the marker, such as `d1711fd`, which
  has no Phase 3. Record the proof in the plan SUMMARY.
- **D-P6-06:** The merge procedure's re-verifications become plan tasks:
  - the switch scenario;
  - Phase 2's `info` status scenarios under both profiles;
  - `features/hook/mcp-tool-names.feature` and `tool-use.feature` under both
    profiles (Phase 5);
  - `agent-grants.feature` under both profiles (Phase 4).

  `npm run check` already runs both profiles. These tasks record the result
  per feature file.

### Closed sets, fallow, and frozen exports

- **D-P6-07:** Six closed-set entries are candidates: `requires mcp`,
  `requires builtin mcp`, `overridden by mcp.json`, `project not trusted`,
  and the companions `mcp` and `builtin mcp`. Each one that has no emitter on
  the combined tree is removed: no production code path builds it, and no
  scenario observes it. Each removal also updates the lock counts,
  `docs/json-output.md`, and the regenerated wire schema in the same commit.
  An entry that still has an emitter stays. The plan records the emitter for
  each kept entry.
- **D-P6-08:** `.fallowrc.json` changes as follows:
  - Drop the `entry` lines for `domain/mcp-implementation.ts` and
    `orchestrators/mcp/recorded-servers.ts`, and every `ignoreExports` name
    the combined tree now consumes. That is 7 names per the 03-09 SUMMARY,
    plus `ActiveMcpImplementation` and the `features/lib/mcp-implementation.ts`
    entry (P1-DC-33).
  - For each export with still no consumer (`StoredMcpCompatibility`,
    `LegacyServers`, `LegacyServersUnreadableError`,
    `LegacyServersUnreadableReason`, and any others that `fallow dead-code`
    reports), remove the `export` or the symbol itself. Do not keep the
    ignore. Before each removal, run `fallow dead-code --trace` on it.
  - Then update the entry and suppression counts in CONVENTIONS.md,
    STACK.md, and ARCHITECTURE.md.
- **D-P6-09:** Remove `SoftDepStatus.piMcpAdapterLoaded` once no reader is
  left. If readers remain, repoint them to `mcpImplementation`, and keep the
  change behavior-neutral.

### Parent-line code changes

- **D-P6-10:** These parent lines are applied in Phase 6 as code:
  - **P4-DC-60 (High):** repoint `updateAgentImplementation` to Phase 3's
    implementation field on `ThreePhaseArgs` and `PluginConvergeTarget`. Add
    a `@builtin-only` scenario for an autoupdate or apply catalog move that
    rewrites the agent grant for built-in MCP.
  - **P3-DC-22:** `edge/register.ts` passes the run's implementation to the
    completion resolver, and `shared/completion-cache.ts` keys by it. Add a
    cucumber scenario only if a user can see the difference. Otherwise
    write a unit test, and record why the change is invisible.
  - **P2-DC-53:** `adapter-expansion-conformance.test.ts` passes the encoder,
    and the parameter becomes required.
  - **MANF-01:** `manifest-read-agreement.test.ts` lists
    `bridges/mcp/builtin-description.ts`.
  - **P2-DC-18:** move `features/lib/mcp-builtin-tool-search.ts` into
    `features/lib/upstream/`.
  - **UF-4:** redact the frozen legacy reader's debug line.
  - **UF-1:** the legacy reader re-checks `resolvedSource` against the
    owning clone root with `assertPathInside` (NFR-10).
  - **01-FROZEN.md interface 3:** fix the outdated text.
- **D-P6-11:** P2-DC-77 (the Pi 1.5.0 RPC `new_session` double `session_start`
  that leaks built-in stdio connections): the harness waits for the
  stand-ins before `assertStandInsStopped`. If the leak still fails the
  scenario under built-in, the scenario stays `@adapter-only`. In that case:
  - Add a BACKLOG entry with a drafted upstream report.
  - File nothing upstream. Filing is outward-facing and the user's call.
- **D-P6-12:** Every other parent line that is not docs or records moves to
  BACKLOG.md as one entry each, with its source ID. This covers:
  - MCPV2-01..03;
  - the deny-list re-pin to 2.1.318 (P2-DC-22);
  - the BLT-04 load-time notice;
  - ToolSearch naming;
  - `details.tool` recovery;
  - the hardening for the case where both implementations are loaded
    (P5-DC-15);
  - the matcher gaps (P5-DC-16);
  - the no-implementation hook scenario (P5-DC-24);
  - the pending and apply disagreement (P3-DC-122);
  - the two Phase 4 BACKLOG items;
  - the Phase 1 "if Phase 2/3 does not settle them" items that are still
    open on the combined tree.

### Records and logs

- **D-P6-13:** PROJECT.md changes:
  - Add Key Decisions rows for the phase decisions the children proposed:
    the Phase 3 candidates, D-P5-01..04 and D-P5-06/07, and D-MB-03/12 text
    from Phase 4.
  - Mint D-MB-14 and up for the Phase 2 licenses cited in the docs (P2-DC-90:
    P2-DC-02/04/05/08/10/13/14/20/46), and re-point the citations in
    `docs/mcp-compatibility.md`.
  - D-MB-08..13 stay `-- Pending` for the user.
  - Mark the requirements validated.

  REQUIREMENTS.md traceability rows are marked Complete for Phase 2's 11 IDs.
- **D-P6-14:** The milestone's root log of dubious choices is committed at
  `.planning/milestones/mcp-builtin-DUBIOUS-CHOICES.md`:
  - The previous milestone's file there moves with `git mv` to
    `.planning/milestones/component-features-DUBIOUS-CHOICES.md`, beside
    that milestone's other archives.
  - The new root log is built from the parent's working log, which copies
    every P1..P5 entry, the parent's own P6-PRE entries, and the P6-DC
    entries.
  - Its "Decisions waiting on you" list leads with the High items.
- **D-P6-15:** The codebase maps (`.planning/codebase/*.md`) get targeted
  edits for the new modules, entries, counts, and zones. `/gsd-map-codebase`
  is not re-run. The cucumber skill gets the notes from Phases 2 and 5: the
  config probe, the profile-aware call step exception, and the stand-in
  entries.
- **D-P6-16:** CI timing: the parent pushes the final tree and dispatches
  `ci.yml` on `features/mcp-builtin`. Executors have no GitHub tools
  (P1-DC precedent). The plan's last task writes a handoff file. The
  D-CF1-16 row is amended with the new timings. A behavioral job timeout
  changes only if a leg uses more than 80% of it.
- **D-P6-17:** The version bump and the PR are not in this phase. AGENTS.md
  says to offer the bump before creating a PR, so the parent offers it in the
  user review after the milestone close.

### Claude's Discretion

- Plan split and wave order. Docs and records can run in parallel with the
  code changes. The closed-set cleanup and fallow changes come after the code
  changes that consume exports.
- The exact CHANGELOG and README wording, within the skills.

### Deferred Ideas (OUT OF SCOPE)

- The version bump and PR creation (D-P6-17).
- Filing the Pi 1.5.0 RPC defect upstream (D-P6-11).
- Every item D-P6-12 moves to BACKLOG.md.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MDOC-02 | CHANGELOG, README, `README.es.md`, and `docs/hooks-compatibility.md` describe built-in MCP support, the three `requires` markers, and the naming divergence; the docs say to turn on built-in MCP or install pi-mcp-adapter, and list what the adapter adds | §1 (current text with line numbers, "adapter adds" list with citations, markers, naming, catalog lines, CHANGELOG candidates) |
| DUAL-04 | Switch scenario: adapter reaches server; adapter removed shows `{requires mcp}` with built-in off; built-in on reaches; adapter again reaches; no plugin command in between | §2 (the `list` read, built-in-off proof, wording argument, worktree red proof) |
</phase_requirements>

## Standard Stack

No package is installed or upgraded in this phase. Every tool is already in the lockfile.

| Tool | Version (verified) | Purpose |
|------|--------------------|---------|
| Node | v24.22.1 `[VERIFIED: node --version]` | runtime |
| npm | 10.9.9 | scripts |
| fallow | `^3.33.1` (STACK.md) | dead-code/dupes/trace probes |
| `@cucumber/cucumber` | lockfile | profiles `adapter`, `builtin` (`cucumber.json`) |
| Pi | `@earendil-works/pi-coding-agent` 1.5.0 `[VERIFIED: node_modules/@earendil-works/pi-coding-agent/package.json]` | built-in MCP source citations |
| pi-mcp-adapter | 7.0.0 `[VERIFIED: node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/package.json]` | adapter source citations |
| pre-commit | 4.7.0 | mdformat/markdownlint for docs |

## Package Legitimacy Audit

Not applicable. This phase installs no external package. `package.json`, `package-lock.json`, `cucumber.json`, and `scripts/install-test-peers.mjs` are byte-identical between `d1711fd` and `HEAD` (`git diff --stat` printed nothing).

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## 1. MDOC-02: documentation inventory

### 1.1 Current MCP text (to change)

| File:line | Current text (verbatim excerpt) | Change |
|-----------|-------------------------------|--------|
| README.md:29 | `- MCP servers. Requires [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter). For more information, see [MCP compatibility](docs/mcp-compatibility.md).` | Name either implementation; built-in serves without the adapter; turn on built-in MCP or install the adapter; adapter runs when both loaded (D-P6-02); built-in runs project servers only in a trusted project and picks up plugin changes at `/reload` (02-08 item 2) |
| README.md:40 | `- [pi-mcp-adapter](...) 7.0.0 or a later 7.x release (optional but recommended, \`pi install npm:pi-mcp-adapter\`).` | Optional because Pi's built-in MCP runs plugin servers without it |
| README.md:126 | `... pi-mcp-adapter stores each server under a key that ends with \`_\`. ...` and table :128-132 (`Adapter server key` column) | Add built-in name `plugin_<plugin>_<server>` (no trailing `_`); recommend a `my-db` row to show the `-`→`_` tool-name fold (see 1.4) |
| README.md:144 | `... an MCP server that uses a feature pi-mcp-adapter cannot run, or an MCP bundle.` | 03-09: "an MCP server that the MCP implementation Pi runs cannot run (pi-mcp-adapter or Pi's built-in MCP)" |
| README.md:27 | `- Agents. Requires [pi-subagents](...).` | Conditional (04-06 item 6): if built-in enters Features, add "An agent's MCP grants follow the MCP implementation in use." |
| README.es.md:29, :40, :126-132, :144, :27 | Spanish mirrors (e.g. :144 `un servidor MCP que usa una función que pi-mcp-adapter no puede ejecutar`) | Same changes, same commit; 03-09 gives :144 Spanish text verbatim: "un servidor MCP que la implementación de MCP que ejecuta Pi no puede ejecutar (pi-mcp-adapter o el MCP integrado de Pi)"; 04-06 gives "Los permisos MCP de un agente siguen la implementación MCP en uso." |
| CHANGELOG.md:3-5 | `## [Unreleased]` / `- The extension now needs Pi 1.5.0 or newer.` | Fold into the milestone lead bullet (D-P6-01) |
| docs/hooks-compatibility.md:148 | already: fold of `-` and every char outside `[A-Za-z0-9_]` in the tool segment, server kept with `-`, "Pi ends a tool's name with a hash ... longer than 64 characters ... A long name is also cut before the hash" | Add the exact cut: Pi keeps the first 55 characters, then `_`, then the first 8 hex digits of sha256 of `<server>\0<tool>` `[VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/extensions/mcp/tools.js:29 "const MAX_TOOL_NAME_LENGTH = 64;" and :45-51 "const hash = createHash(\"sha256\").update(\`${server}\0${tool}\`).digest(\"hex\").slice(0, 8); return \`${name.slice(0, MAX_TOOL_NAME_LENGTH - hash.length - 1)}_${hash}\`;"]` (64−8−1 = 55) |
| docs/hooks-compatibility.md:150 | already: "This proxy rule applies only while pi-mcp-adapter is the active MCP implementation. ... (MHK-02)" | Done by Phase 5 (D-P5-14). No change needed. Optionally cite `features/hook/tool-use.feature` (already cited) |
| docs/hooks-compatibility.md:33, :101 | `blocked on \`pi-mcp-adapter\` exposing the relevant MCP request` (Elicitation) | Optional: "blocked on pi-mcp-adapter or Pi's built-in MCP exposing ..." (Pi 1.5.0 has no elicitation, REQUIREMENTS Out of Scope row) `[ASSUMED wording]` |

**Already correct, keep:** docs/mcp-compatibility.md:17-28 ("Choosing an implementation", incl. how to turn built-in on: remove pi-mcp-adapter and its `-builtin:mcp` entry from `~/.pi/agent/settings.json`). The harness uses the same entry. `[VERIFIED: features/lib/mcp-implementation.ts:77 const BUILTIN_OFF_ENTRY = "-builtin:mcp";]`

### 1.2 docs/mcp-compatibility.md: Phase 4 agents text, not yet applied

04-06 item 4 is **not** on the combined tree (grep for `with no \`_\` at the end` and `rewrites each generated agent file` finds nothing). Its line numbers moved. Targets today:
- :42-44 (built-in names paragraph, after "pi-subagents `mcp:` entries also use the key." at :44): add the built-in `plugin_<plugin>_<server>` sentence.
- :358 bullet ("A `tools:` entry that names one of the plugin's own MCP tools ..."): add the built-in `mcp:plugin_<plugin>_<server>/<tool>` text, `excludeTools` form, 64-char hash, sse grant dropped.
- :360 paragraph (async): built-in warning ending and pi-subagents 0.84.0 refusal text.
- :366 ("In Claude Code, a subagent ..."): "A launch before pi-mcp-adapter has cached the server's tools, or before Pi's built-in MCP has listed them, fails too."
- :371-382 override example: add `mcp:plugin_foo_github` sentences.
- New paragraph at end of "Customizing generated agents" (D-MB-03, MGRT-01, MGRT-02).
- Re-point the `features/mcp-server/invocation.feature` citations in that section to `features/mcp-server/agent-grants.feature`. Verify each citation with grep first.
The full draft text is in `06-PARENT-LINES.md` lines 240-245, copy it verbatim and adapt it.

### 1.3 What the adapter adds over Pi's built-in MCP (for README, D-P6-02)

Each item has a doc anchor and its proof. The proofs are already cited in docs/mcp-compatibility.md.

| Adapter adds | Built-in instead | Proof (cite in README via the doc link) |
|--------------|------------------|----------------------------------------|
| `type: "sse"` servers run (`httpTransport: "sse"`) | refused; plugin partially available | mcp-compatibility.md:313 row; `dist/core/mcp-servers.js`; `features/mcp-server/verdict-list.feature` |
| Plugin tools reachable with `tool_search` off (adapter's `mcp` proxy tool) | deferred tools only via `tool_search` | :90 row; `dist/extensions/mcp/index.js` |
| Detailed status in `info`: `cached, connects on first use`, `needs authentication`, `pending approval`, `failed` | only `connected`, `disabled`, `not connected`, `not loaded`, `overridden by …`, `project not trusted` (P2-DC-10) | :517-532 table; `features/mcp-server/builtin-status.feature` |
| Your overrides in `mcp-adapter.json` (`disabled`, `approveTools`, `includeTools`, `excludeTools`, `requestTimeoutMs`, …) survive updates | Pi reads none; no user timeout | :332-338; `features/mcp-server/lifecycle.feature` (disabled) |
| A lasting per-server disable (`/mcp-adapter disable`) | `/mcp` turns a server off for the session only | :211; `dist/extensions/mcp/index.js` |
| Project-server approval step (`pending approval`) | none; trust alone gates (D-MB-09) | :193; `features/mcp-server/project-scope.feature` |
| Tool names keep `-` and are never cut | `-`→`_` in the tool name; cut over 64 chars | :597-598; `features/mcp-server/listing.feature`; `dist/extensions/mcp/tools.js` |
| (Built-in adds) a server with `bareElicitationCapability: true` runs | adapter blocks it | :311 row; `features/mcp-server/project-scope.feature` |

### 1.4 Naming as implemented (D-MB-13, CR-02, Phase 5)

- Built-in server name: `plugin_<plugin>_<server>`. Every character outside `[A-Za-z0-9_-]` becomes `_`, `-` stays, and there is no trailing `_`. `[CITED: PROJECT.md:1995 D-MB-13]`
- Built-in tool name: Pi's `createMcpToolName(server, tool)`. It turns every character outside `[A-Za-z0-9_]` into `_` (so `-` too). A name over 64 characters becomes 55 characters + `_` + 8 hex. `[VERIFIED: dist/extensions/mcp/tools.js:45-51]` A second tool that sanitizes to a taken name also gets the hash. The owner is `` `${server}\0${tool.name}` `` `[VERIFIED: dist/extensions/mcp/index.js:298-313]`, so a duplicate connection of the same tool does not hash.
- Adapter tool name (toolPrefix `mcp`): `mcp__<key>` + `_` + tool, with only `.`→`_`. `-` is kept. `[VERIFIED: node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/dist/types.js:116-143, "const sanitized = toolName.replace(/\./g, \"_\");" and validCharacters /^[A-Za-z0-9_-]$/]`
- Example for the README row: plugin `foo`, server `my-db`. Adapter key `plugin_foo_my-db_`, adapter tools `mcp__plugin_foo_my-db__<tool>`. Built-in server `plugin_foo_my-db`, built-in tools `mcp__plugin_foo_my_db__<tool>`. `info` shows `plugin:foo:my-db`. (docs/mcp-compatibility.md:597 gives `mcp__plugin_demo_my_db__echo` for `my-db`.)
- Hooks (Phase 5, docs/hooks-compatibility.md:148): a hook sees `mcp__<registered server, - kept>__<Pi's tool segment>`.

### 1.5 The three `requires` markers as implemented (D-MB-07)

`[VERIFIED: extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts:133-156]` `MCP_NAME_TABLE`:
- `both`: none → `{companion:"mcp", missing:true}`; adapter/builtin → `mcp`, not missing
- `adapter` (only the adapter runs every server): none/builtin → `pi-mcp-adapter` missing; adapter → not missing
- `builtin`: none/adapter → `builtin mcp` missing; builtin → not missing
- `split`: none → `mcp` missing; adapter → `builtin mcp` missing; builtin → `pi-mcp-adapter` missing

The marker is `` `requires ${companion}` `` exactly when `missing` (soft-dep.ts:182-192). Rows observed: `features/mcp-server/companion-missing.feature:30` (`requires mcp`), `:54` (`requires pi-mcp-adapter`, sse), `:78` (`requires builtin mcp`, elicitation). Beside `{unsupported mcp}`: `verdict-list.feature:57` (`unsupported mcp, requires pi-mcp-adapter`), `verdict-markers.feature:398` (`unsupported mcp, requires builtin mcp`). `info` requires: `companion-missing.feature:141` `[{"companion":"mcp","missing":true}]`.

### 1.6 Frozen catalog lines and their fixture (D-P6-04)

Byte contract: `test/architecture/catalog-uat/catalog-contract.test.ts:21-22`: `const EXPECTED_STATE_COUNT = 324;` and `const EXPECTED_UTF8_BYTES = 54_652;`. The bytes are `Buffer.byteLength(example.expected)` summed over the fenced catalog blocks (:282-300). Prose is **not** counted. Only the rendered fenced lines are.

| Doc line | Kind | Exact change (03-09 parent lines) | Fixture literal | Byte delta |
|----------|------|-----------------------------------|-----------------|------------|
| output-catalog.md:69 | prose | three MCP markers + D-MB-07 follow sentence | — | 0 |
| output-catalog.md:3041 | prose | "MCP servers need the implementation that runs every server (`mcp` for either, `pi-mcp-adapter`, or `builtin mcp`)"; "sorted by name (so `builtin mcp` and `mcp` come before the `pi-` names)"; `(missing)` iff D-MB-07 marker; no MCP entry when both block every server | — | 0 |
| output-catalog.md:3161 prose + :3171 rendered | prose+block `installed-with-missing-companion` | rendered `requires: pi-mcp-adapter (missing), pi-subagents` → `requires: mcp (missing), pi-subagents`. Prose: "With no MCP implementation loaded, the `github` server's state is `status unknown`" (companion-missing.feature:117-134 shows `status unknown` with none) | plugin-info.ts:86 `{ companion: "pi-mcp-adapter", missing: true }` → `{ companion: "mcp", missing: true }` (order stays: `mcp` < `pi-subagents`) | −11 |
| output-catalog.md:3176-3188 | prose+block `installed-with-every-companion` | rendered `requires: pi-dynamic-workflows (missing), pi-mcp-adapter, pi-subagents` → `requires: mcp, pi-dynamic-workflows (missing), pi-subagents` | plugin-info.ts:113-117 reorder to `mcp` (false), `pi-dynamic-workflows` (true), `pi-subagents` (false). The renderer only formats, so order is the literal's (catalog comment :65-67) | −11 |
| json-output.md:723 | table meaning | "Companions (extensions or MCP implementations) the resolved components need, sorted by name. The MCP entry names `mcp` (either implementation runs every server), `pi-mcp-adapter`, or `builtin mcp`." | — | 0 |
| json-output.md:766 | table meaning | "Companion extension or MCP implementation that a component needs: `pi-subagents`, `pi-dynamic-workflows`, `mcp`, `pi-mcp-adapter`, or `builtin mcp`." | — | 0 |

So the two named blocks move `EXPECTED_UTF8_BYTES` 54_652 → **54_630** (state count stays 324). The 03-09 note "counters stay ... unless the example block is a counted fixture" applies: these blocks are counted.

**Wider question (dubious, see table):** seven more blocks render `requires: pi-mcp-adapter` for plugins whose servers both implementations run, so today's code would emit `mcp`. They are output-catalog.md:3427, 3441, 3455, 3469, 3483, 3513, 3518, with fixture literals at plugin-info.ts:533, 563, 593, 615, 637, 695, 711. Changing all of them to `mcp` costs another −77 bytes (→ 54_553) and keeps the catalog true to the code. The prose at :3418, :521, and :736 ("a Claude Code MCP feature that pi-mcp-adapter cannot honor") and json-output.md:753 (`unsupportedFeature`) follow the 03-09 rule "reads 'the active MCP implementation cannot run'". **Recommendation:** change all nine blocks and their literals in the one catalog commit.

Other docs lines from parent lines (02-08 item 5, not yet applied): beside the adapter status table (output-catalog.md:3044-3056), add the built-in mapping table (`connected` = a namespace tool not hidden, `disabled` = all hidden, `not connected` = registered with no tool, `not loaded` = not registered, `overridden by mcp.json`, `project not trusted`, `overridden by project scope`). Add a json-output.md sentence (the token list is at :951) saying which tokens each implementation emits. The two proposed **example blocks** (`overridden by mcp.json`, `project not trusted`) would be new catalog states: +2 to `EXPECTED_STATE_COUNT`, new fixtures in plugin-info.ts, and new bytes. **Recommendation:** add them only as prose and table rows, not as new catalog states, and record the choice as dubious.

Pre-commit (mdformat) re-aligns markdown tables, so table edits in json-output.md need `pre-commit run --files docs/json-output.md`.

### 1.7 CHANGELOG candidate lines (all parent lines, one list)

Rewrite each to ≤40 words and ≤25 per sentence (the changelog skill). Sources are verbatim in `06-PARENT-LINES.md`.

1. (CHANGELOG.md:5, P1-DC-27) "The extension now needs Pi 1.5.0 or newer." Fold it into the lead bullet or the first sub-bullet.
2. (02-08 item 1) "Plugin MCP servers now run through Pi's built-in MCP when pi-mcp-adapter is absent, at each start and `/reload`, only in projects that Pi trusts, with their status in `info`. Switching needs no plugin command."
3. (03-09 b1) `install` and `list` show `{requires mcp}` / `{requires builtin mcp}`; `{requires pi-mcp-adapter}` only when only the adapter runs them all.
4. (03-09 b2) state, server verdicts, and `--partial` consent follow the implementation Pi runs; `list`, `info`, `fetch` show it; `info` shows each server as written or left out with the blocking feature. (Same as the child-message candidate at 06-PARENT-LINES.md:327, merge them.)
5. (03-09 b3 + P3-DC-112 correction at 06-PARENT-LINES.md:203) `install` asks `--partial` only for a server the active implementation cannot run (sse under built-in, elicitation under adapter); with none, only servers neither runs; a dependency move during `install`/`update` asks only for a server the installed version does not already leave out; a plain `update` asks as before; `enable`/`apply` never ask after a switch; `pending` previews `(will partially install)` only where the active implementation cannot run a server.
6. (03-09 b4) `info`'s `requires:` names `mcp`, `pi-mcp-adapter`, or `builtin mcp`, `(missing)` when the active one cannot run them all; `info --json` reports `{"companion":"mcp"}` where it reported `pi-mcp-adapter`.
7. (CR-01, WR-05) "The first load after the upgrade records the MCP servers of plugins installed by earlier versions together with their implementation-neutral verdict, when the recorded version's servers can still be read."
8. (MGRT-01, 04-06 item 5) generated agent's MCP grant names the active implementation's server; after a switch, the next start or `/reload` rewrites only changed agent files. With P4-DC-60 this also covers `apply` and autoupdate moves.
9. (MGRT-02) a pi-subagents background child changes no installation state (no autoapply, no MCP move, no agent rewrite).
10. (05-04 item 1, covers 05-02) hooks see built-in MCP tools under Claude Code's names `mcp__<server>__<tool>` with the server's `-` kept; only the tool segment keeps Pi's `-`→`_`; the proxy-call rule applies only under pi-mcp-adapter; under built-in every call runs its hooks.
11. (new, if P3-DC-22 lands) Tab completion for `install`/`update` follows the active MCP implementation.
12. Optional: the hash/cut of built-in tool names over 64 characters (MDOC-02 "naming divergence"). It can live inside item 10 or in a separate sub-bullet.

The lead line: one sentence naming built-in MCP support, Pi 1.5.0, and that switching needs no plugin command. No PR number yet (D-P6-01).

## 2. DUAL-04: the switch scenario

**Scenario:** `features/mcp-server/implementation-switch.feature:50-114`, tagged `@own-implementation` (line 50).

**Profile:** `@own-implementation` runs under the **adapter profile only**. `[VERIFIED: cucumber.json "adapter" tags "not @builtin-only"; "builtin" tags "(@mcp or @builtin-only) and not @adapter-only"]` So DUAL-04 is proved by `--profile adapter`.

**Built-in is off after `the user restarts pi without pi-mcp-adapter` (line 79):**
- `startProfilePi` removes the harness onboarding seed for an `@own-implementation` scenario that loads the adapter, so pi-mcp-adapter makes its real first-run write of `-builtin:mcp` to the user settings. `[VERIFIED: features/support/world.ts:870-875 "if (adapterLoaded && this.ownImplementation) { ... await removeAdapterOnboardingSeed(...)"]`
- `restartPi` waits for the adapter's onboarding file when the stopped launch had the adapter (world.ts:655-658), stops Pi, asserts stand-ins stopped, and for `without-adapter` only drops the adapter from companions (world.ts:918-929). It does not touch settings.
- The new Pi's start asserts the implementation its launch implies: `adapterLoaded` false and `builtinTurnedOff` read from settings, so `none` (world.ts:876-880, `features/lib/mcp-implementation.ts:1-12` header). **The world itself fails the step unless the Pi runs no MCP implementation.** That is the proof that built-in is off.

**Which read shows `{requires mcp}`:** the load prints nothing on a matching state ("Then the session reports no results", line 80, `features/step_definitions/session.steps.ts:137-139`). `info` shows `plugin reasons` empty and `plugin requires [{"companion":"mcp","missing":true}]` (companion-missing.feature:117-145), not the marker. **`/claude:plugin list` shows the marker on the installed row.** `list-installed-row.ts:254` passes `dependencies: dependenciesFromRecord(record, recorded)`, the resolve step appends the marker, and the precedent is `features/workflow/companion-missing.feature:46-58` (`list` row with `requires pi-dynamic-workflows`). Steps exist: `When the user runs {string}` (command.steps.ts:87-92 runs on `this.pi`, which is the profile Pi, world.ts:214-216), `Then the result has these fields:` (:94), `Then the result lists these plugins:` (:102).

**Recommended rows** (insert after line 81, `Then pi reports no extension error`, before the mcp tool listing):

```gherkin
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons      | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed | requires mcp | user  | 1.0.0   |
```
The field values copy the `list` precedent (workflow/companion-missing.feature:48-58). `[ASSUMED: severity info and 0 warnings for a requires-only row under list. The precedent shows this for requires pi-dynamic-workflows. Confirm on the first run.]`

**Is `list` a "plugin command"?** DUAL-04 says "with no plugin command in between". MSEL-02 states the intent: "with no reinstall, `apply`, or other plugin action". `list` changes no installation state and is offline by NFR-5 ("`list`, `info` ... MUST NOT touch the network"). D-P6-05 itself names `list`/`info` as the read. **Recommendation:** use `list`. Add a comment line above it: `# A read-only list changes no installation state, so the switch still needs no plugin action (MSEL-02, NFR-5).` Optionally retitle the scenario "... and back with no plugin action (MSEL-02, MSEL-03, D-MB-01, DUAL-04)". No non-command user surface shows the marker while the load is quiet. The extension's LLM tool `pi_claude_marketplace_plugin_list` (`edge/handlers/tools.ts:544-546`) would need a model turn and would renumber every later `call` cell (calls 3-7). Rejected.

**Red proof (worktree at `d1711fd`):** `d1711fd` = Phases 1+5+4+2, no Phase 3 (`git log --first-parent`: `a25cd35` merges read-time verdicts on top of `d1711fd`). At `d1711fd` the switch scenario exists (`git ls-tree d1711fd features/mcp-server/` lists `implementation-switch.feature`), and the Phase 1 marker for no implementation is `requires pi-mcp-adapter`. So the new row fails with `requires pi-mcp-adapter` ≠ `requires mcp`. Procedure:
```bash
git worktree add /tmp/<scratch>/dual04-red d1711fd
ln -s /home/user/pi-claude-marketplace/node_modules /tmp/<scratch>/dual04-red/node_modules   # deps identical (verified)
cp features/mcp-server/implementation-switch.feature /tmp/<scratch>/dual04-red/features/mcp-server/
cd /tmp/<scratch>/dual04-red && npm_config_script_shell=<nondac-sh> NODE_OPTIONS=--max-old-space-size=6144 \
  npx cucumber-js --profile adapter --name "moves from pi-mcp-adapter to pi's built-in mcp" features/mcp-server/implementation-switch.feature
# expect: FAIL at "the result lists these plugins" (reasons requires pi-mcp-adapter)
git worktree remove --force /tmp/<scratch>/dual04-red
```
Call `npx cucumber-js` directly, not `npm run test:cucumber:profile`, so `install-test-peers.mjs` does not write the shared peer cache through the symlink. The cache is already populated. Paste the failing assertion into the SUMMARY.

## 3. Closed sets (D-P6-07): keep all six

| Entry | Definition | Production emitter (combined tree) | Scenario that observes it | Verdict |
|-------|-----------|------------------------------------|---------------------------|---------|
| reason `requires mcp` | notification-types.ts:298; notification-wire.ts:164; notify-reasons.ts:124 | soft-dep.ts:191 `` `requires ${companion}` `` with `COMPANION_ANY_MCP` (:100, table :137/:152) | companion-missing.feature:30; DUAL-04 row | **keep** |
| reason `requires builtin mcp` | notification-types.ts:299; wire:165; notify-reasons.ts:125 | soft-dep.ts:191 with `COMPANION_BUILTIN_MCP` (:101, table :147-148, :153) | companion-missing.feature:78; verdict-markers.feature:398 | **keep** |
| status `overridden by mcp.json` | notification-types.ts:1166; wire:199 | orchestrators/plugin/info-mcp-status.ts:194 | builtin-status.feature:129-147 | **keep** |
| status `project not trusted` | notification-types.ts:1167; wire:200 | info-mcp-status.ts:211 | builtin-status.feature:159-176 | **keep** |
| companion `mcp` | soft-dep.ts:73,100; wire COMPANIONS `mcp: true` | soft-dep.ts table (`companionRequirements`) | companion-missing.feature:141, :175 | **keep** |
| companion `builtin mcp` | soft-dep.ts:73,101; wire `"builtin mcp": true` | soft-dep.ts table | verdict-info.feature:180, :209 | **keep** |

Lock counts stay: `test/architecture/notify-closed-set-locks.test.ts:237` `assert.strictEqual(memberCount, 80);` (Reason) and `:284` `assert.strictEqual(memberCount, 12);` (McpServerStatus). There is no json-output.md or schema change (`schema/claude-plugin.schema.json:184-185` etc. already list both reasons). The plan records this table and needs no commit for D-P6-07.

**`SoftDepStatus.piMcpAdapterLoaded` (D-P6-09):** `[VERIFIED: platform/pi-api.ts:172-181 interface; :368 producer "piMcpAdapterLoaded: adapterLoaded,"]`. **Zero production readers** (`git grep "\.piMcpAdapterLoaded"` in extensions: none). Test-only: 34 files, 217 occurrences. Almost all are standalone object-literal lines `piMcpAdapterLoaded: <expr>,` (deletable line by line). The exceptions are test/platform/pi-api.test.ts:88, :1032, :1045, :1061 (row type, destructure, deepStrictEqual, and the "reports the adapter loaded exactly when ..." loop, which is deleted) and test/shared/concerns/soft-dep.test.ts:555, :781 (two "ignores the adapter-loaded flag" cases whose premise disappears, so delete them). The file list: `git grep -l piMcpAdapterLoaded -- test`. It includes the shared support files `test/shared/notification-run-seeds.ts` and `test/orchestrators/plugin/install-flow-fixture.ts`, so the commit hook runs **all pairs' coverage**. Docs and `.agents` have no mention. ROADMAP.md:214 (frozen interface 2 text) is historical. Leave it. Removal is behavior-neutral and is a frozen-interface change licensed by D-P6-09.

## 4. Fallow (D-P6-08)

**Today** `[VERIFIED: .fallowrc.json:2-31]`:
```json
"entry": ["extensions/pi-claude-marketplace/index.ts",
          "extensions/pi-claude-marketplace/domain/mcp-implementation.ts",
          "extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts"],
"ignoreExports": [
  { "file": "extensions/pi-claude-marketplace/domain/mcp-implementation.ts",
    "exports": ["ActiveMcpImplementation", "EffectiveMcpCompatibility", "StoredMcpCompatibility", "effectiveMcpCompatibility"] },
  { "file": "extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts",
    "exports": ["LegacyServers", "LegacyServersReader", "LegacyServersSource", "LegacyServersUnreadableError",
                "LegacyServersUnreadableReason", "createLegacyServersReader", "recordedMcpServers"] }
]
```
**Already applied:** the `features/lib/mcp-implementation.ts` and `platform/pi-api.ts` ignoreExports entries were removed in `13ce40a` ("drop export exemptions that now have consumers", the IN-05 review fix, P1-DC-33). Do not redo this.

**Probe run (read-only, temp config with `entry` = index.ts only and no `ignoreExports`, `npx fallow dead-code --no-cache -c <tmp>`):**
```
● Unused exports (1)   orchestrators/mcp/recorded-servers.ts :88 LegacyServersUnreadableError
● Unused type exports (1) orchestrators/mcp/recorded-servers.ts :81 LegacyServersUnreadableReason
✗ 1 export · 1 type   2 issues · 15 suppressed · 0 stale suppressions
```
`--trace` on each: `LegacyServersUnreadableError`, `LegacyServersUnreadableReason`, `LegacyServers`, `StoredMcpCompatibility` → "No references found, export is unused". Fallow still does not report `LegacyServers` and `StoredMcpCompatibility` as findings. They appear in exported signatures: `LegacyServersReader` returns `Promise<LegacyServers>` (recorded-servers.ts:36), and `effectiveMcpCompatibility(stored: StoredMcpCompatibility, ...)` (mcp-implementation.ts:230/265/305). Removing their `export` would create a private-type leak, and `test/domain/mcp-implementation.test.ts:17` imports `StoredMcpCompatibility`. **Keep both exported. Only drop the ignore.**

**Actions:**
1. `.fallowrc.json`: `entry` → `["extensions/pi-claude-marketplace/index.ts"]`. Delete the whole `ignoreExports` key.
2. `recorded-servers.ts:81` `export type LegacyServersUnreadableReason` → `type ...`. `:88` `export class LegacyServersUnreadableError` → `class ...`. The only importer is `test/orchestrators/mcp/recorded-servers.test.ts:11` (`unreadableAs(reason)` at :81-84 uses `instanceof`). Rewrite the test to assert through the public reader: `assert.rejects(reader(record), { name: "LegacyServersUnreadableError", reason: "<r>" })` or a message match. The unit-test skill forbids exporting for tests (pairing-and-design.md:30).
3. If UF-1 adds a refusal reason (see §5), the union stays private.
4. Re-run `npx fallow dead-code` (gate) and `npx fallow dupes` after.

**`fallow-ignore` markers today:** `rg -n "fallow-ignore" extensions features test scripts | wc -l` = **45**. By type: 7 `unused-file`, 25 `code-duplication`, 5 `private-type-leak`, 7 `unused-export`, 1 `unused-type`. CONVENTIONS.md:69 says **44** with "23 code-duplication", "6 unused-export", "3 unused-type (async-rewake registry + `ThinkingLevel`, `InputSource` of pi-api.ts)". `ThinkingLevel` and `InputSource` no longer exist in pi-api.ts (grep: none). The two new `unused-export` markers this milestone are `features/lib/builtin-mcp-stand-in/extension.ts:155` and `features/lib/mcp-builtin-config-probe/extension.ts:22`. The +2 code-duplication markers predate the milestone (no diff vs merge-base `bdbb5f2`). Correct the breakdown to 7/25/5/7/1 = 45 and list the five harness `--extension` defaults (registry probe, scripted model, launch environment, built-in stand-in, config probe).

**Codebase-map text naming the entries:** CONVENTIONS.md:61 ("Its `entry` list names three modules ..."), :62 ("At the end of Phase 1, `ignoreExports` covers ..."; keep the rule, replace the inventory with "none remain"), :69 (counts). STACK.md:49 (dead-code bullet naming the three entries). ARCHITECTURE.md:225 (Circular imports bullet naming the entries).

`npx fallow dupes --no-cache` on the combined tree: **"✓ No code duplication found"** (run this session). The built-in/adapter entry and escape pair raised no clone group.

## 5. Parent-line code changes (D-P6-10, D-P6-11)

### 5.1 P4-DC-60: `updateAgentImplementation` (High)

`[VERIFIED: orchestrators/plugin/update-swap.ts:458-473]`
```ts
function updateAgentImplementation(args: ThreePhaseArgs): ActiveMcpImplementation {
  if (!args.cascade) {
    return args.run.softDeps.mcpImplementation;
  }
  return args.preflightNotification?.run.softDeps.mcpImplementation ?? "none";
}
```
Phase 3's field: `ThreePhaseArgsBase.mcpImplementation: ActiveMcpImplementation` is **required** (update-swap.ts:222-228). `test/orchestrators/plugin/update-swap.test.ts:66` type-asserts that it is not optional. **Change:** `return args.mcpImplementation;`. The 04-06 fallback chain is unnecessary because the field is required. Rewrite the doc comment (:457-466).

Producers of the field: the direct `update` (update-flow.ts:323 `opts.run.softDeps.mcpImplementation`), reinstall (reinstall-flow.ts:424), dependency moves (dependency-move.ts:170 `context.softDeps.mcpImplementation`), autoupdate (update-flow.ts:1553-1555 `notification?.run.softDeps.mcpImplementation ?? "none"`, passed at :815), and `apply` convergence (update-flow.ts:851 `target.mcpImplementation`, which `apply.ts:1376/1828/2374` set from `opts.run.softDeps.mcpImplementation`). So the change is behavior-neutral for direct and dependency-move paths. It changes `apply` convergence (today `none` → adapter form) and an autoupdate run that has a notification but no `preflightNotification`.

**Unit tests to update** (update-swap.test.ts:2579-2622): "a direct swap under Pi's built-in MCP" sets `run: builtinRun()` while `directSwapArgs` has `mcpImplementation: "none"` (:1235, :166). It must set `mcpImplementation: "builtin"`. "a cascade swap reads the built-in MCP of the command it runs for" (via `preflightNotification`) needs `mcpImplementation: "builtin"`. "P4-DC-13: a cascade swap with no run snapshot restages pi-mcp-adapter's grant" becomes "a swap restages the grant of the implementation its arguments carry" (`mcpImplementation: "none"` → adapter form). Add a case: cascade with `mcpImplementation: "builtin"` and no notification → built-in form. That case is red on HEAD.

**Scenario (user-visible, red under builtin):** add an `@builtin-only` scenario in `features/mcp-server/agent-grants.feature`, a copy of :89-116 ("Updating a plugin ... built-in mcp grant"). Replace the `update` step with `Given the user has run "/claude:plugin apply --scope user", which did not fail`. `apply` converges a dir-source plugin on its catalog version (precedent `features/plugin/staging-warnings.feature:208-221`). Then `subagent get` shows `tools mcp:plugin_demo_stub/echo`. On HEAD the converge path stages `none` → `tools mcp:plugin_demo_stub_/echo`, so the row is red. Optionally add the `@adapter-only` twin (green before and after). The milestone rule pairs differing expectations, and the adapter twin has no red proof (record why). The steps exist: the stand-in registration, `pi runs with the scripted model, pi-subagents, and the mcp implementation`, and the listing wait.

### 5.2 P3-DC-22: completions per implementation (user-visible)

Today: `edge/register.ts:184-185` `getArgumentCompletions(prefix, makeLocationsResolver(process.cwd()), deps.completionCache)` carries no implementation. The cache key is `pluginIndexKey(scope, marketplace)` (completion-cache.ts:153), in memory and on disk (`pluginCacheFile(marketplace)`, schemaVersion 6 file, :283-302). Statuses come from `orchestrators/edge-deps.ts`: `classifyInstalledPluginRow` → `classifyInstalledRecord(installed, candidate)` from stored (neutral) compatibility, and `classifyNotInstalledPluginRow` → `probeManifestEntry` → `classifyManifestEntry(await resolveStrict(...))` (git-source-probe.ts:261-286), the neutral view. `list` instead uses `resolutionFor(outcome.resolved, mcpImplementation)` (list-candidate-row.ts:154).

**Visible difference:** under built-in, a not-installed sse plugin is `partially-available` in `list` (verdict-list.feature:110-133), while completion's neutral view calls it `available`. So plain `install <TAB>` (which offers only `available`, data.ts:24-29) offers a plugin that `install` then refuses without `--partial`. The mirror case is an elicitation plugin under the adapter. A user sees it on Tab, so **a cucumber scenario is required**.

**Design notes for the planner:**
- register.ts reads the implementation per lookup: `openNotificationSnapshot(pi).softDeps.mcpImplementation` (shared/notification-run.ts:71-73, the same probe hooks use per generation). Completion runs only after load. `pi` is in scope in `registerClaudePluginCommand` (register.ts:100-101).
- `makeLocationsResolver(cwd, mcpImplementation)`. The not-installed classifier applies `resolutionFor(resolved, impl)`. The installed classifier needs the effective verdict for the implementation. `plugin-state-classifier.ts` and `git-source-probe.ts` must **not** import `mcp-verdict-read.ts` (cycle; mcp-verdict-read.ts:12-16 names both files). Pass the verdict as data from `edge-deps.ts`, which may call `readRecordMcpVerdict`. Check `edge-deps.ts` is not reachable from `install-outcome.ts` first: `fallow trace --path extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts extensions/pi-claude-marketplace/orchestrators/edge-deps.ts`.
- Cache: key memory **and** file by implementation. Either put the implementation in the file name, or add a field to the file and treat a mismatch as stale. Without that, a 10-minute file TTL serves the other implementation's statuses after a switch. Invalidation (`dropPluginIndex`, :334, :348) must drop every implementation's key.
- Scenario harness: `features/lib/plugin-completions.ts:20-28` calls the provider in-process (not through Pi). Make it take an implementation, and have `completion.steps.ts:11-16` pass `this.mcpProfile`. Non-MCP completion scenarios run only under the adapter profile, so existing rows are unaffected. Add an `@adapter-only`/`@builtin-only` pair, e.g. in `features/mcp-server/verdict-list.feature`, for `install ` completions with an sse plugin: adapter offers `demo@fixtures`, built-in offers nothing. The red proof works at runtime on HEAD's product code, because Node's type stripping ignores the extra argument and the old provider returns the neutral set. This observation does not go through Pi (flagged as dubious).
- Tests: test/edge/register.test.ts (completion resolver test at "resolves argument completions against the working directory"), test/shared/completion-cache.test.ts, and test/orchestrators/edge-deps.test.ts. Direct coverage is 100% per pair.
- Size: medium-large. If the plan finds the installed-record path too costly, a smaller cut handles only not-installed entries (the `install` case) and records the `update --partial` case for BACKLOG. That would be a deviation from D-P6-10, so ask first.

### 5.3 P2-DC-53: required encoder

`[VERIFIED: bridges/mcp/substitute.ts:210-214]` `encoder: McpFieldEncoder = ADAPTER_FIELD_ENCODER,`. The callers without an encoder: `test/integration/adapter-expansion-conformance.test.ts:588-591` and `:672-675`, plus `test/bridges/mcp/substitute.test.ts:529-540` (the case "P2-DC-19: without an encoder the walk writes pi-mcp-adapter's encoding", whose premise disappears, so delete it). Production callers already pass it: adapter-entry.ts:188-192 (`ADAPTER_FIELD_ENCODER`), builtin-entry.ts:63. **Change:** import `ADAPTER_FIELD_ENCODER` at the conformance test's two calls, drop the default (`encoder: McpFieldEncoder`), and fix the doc sentence at substitute.ts:207-208 ("Without an `encoder` the values are written in pi-mcp-adapter's encoding (P2-DC-19)").

### 5.4 MANF-01: manifest-read-agreement gate

`test/architecture/manifest-read-agreement.test.ts:1-32` lists four readers and says "a reader added later is added here too (MANF-01, MANF-02, MANF-05)". `bridges/mcp/builtin-description.ts` reads `MANIFEST_CANDIDATES` (:26, :121) through `locateManifestCandidate` (:22, :106) inside `sourceManifestBoundary`. Its public reader is `readBuiltinServerDescription(source: BuiltinDescriptionSource)` (:131-146; source fields `manifestPath, marketplaceRoot, pluginName, pluginRoot, pin`, :34-43). Add it as a fifth half. Plant wrapped and bare manifests with **different** `description` values, so the returned description proves which file won. Add it to the D-PL2-24 link-shape block (:472), because it reads through the containment. Update the header list and the "all four readers" titles. This is an unpaired architecture test (`test:unpaired`).

### 5.5 P2-DC-18: tool_search projection into `features/lib/upstream/`

`features/lib/upstream/` holds `index.ts` (the `RESULT_PROJECTORS` map, used by `scripted-model/script.ts:19,266`), `mcp.ts`, `pi.ts`, and `subagents.ts`. The cucumber rule (world-and-stand-ins.md:97, :102) says projections of upstream text live there. **Minimal move:** `git mv features/lib/mcp-builtin-tool-search.ts features/lib/upstream/tool-search.ts` (the name is the thing it projects, per layout.md:42), and fix its relative imports (`./run-tokens.ts` → `../run-tokens.ts`). The only importer to fix is `features/step_definitions/mcp-server/builtin-tool-search.steps.ts:11`. Keep the separate step "... with each tool search reduced to the tools it loads:" (used in 8 feature files, 41 `tool_search returned` rows). Registering `tool_search` in `RESULT_PROJECTORS` instead would change the frozen calls step for every scenario. Not recommended. Run `npm run check:features` (dry run) after.

### 5.6 UF-4 and UF-1: the legacy reader

`[VERIFIED: orchestrators/mcp/recorded-servers.ts:58-66]` `hookDebugLog(\`recorded MCP servers unreadable: ${errorMessage(err)}\`, "mcp");`. The registration step's sibling uses `hookDebugLog(redactAbsolutePaths(detail), "mcp")` (builtin-registration-step.ts:106-108). **UF-4:** wrap the message in `redactAbsolutePaths` (shared/redact-absolute-paths.ts). A unit test asserts the debug line holds no absolute path for a reader error that names one. Check how recorded-servers.test.ts observes the debug channel today.

**UF-1** (01-SECURITY.md:76-83; Phase 3 security note at 06-PARENT-LINES.md:207): `recordedRootContext` (recorded-servers.ts:110-128) answers `record.resolvedSource` for **both** root callbacks with no containment check. The registration path already contains the root **before** calling the reader (builtin-registration-step.ts:132-135 `isContained`, using `cloneKeyOf`/`owningRoot`/`isContained` at :124-188 of that file, the T-02-02 closure). The Phase 3 path (`orchestrators/plugin/mcp-verdict-read.ts:44-52, 68, 98`) is uncontained, and its 9 call sites are info.ts:1511, list-installed-row.ts:188, install-flow-results.ts:379/:937, update-swap.ts:1814, dependency-move.ts:171, and reconcile/convergence.ts:490.

The containment needs `ScopedLocations` (`pluginClonesDir`, `pluginCloneDir`, `sourceCloneDir`), which `LegacyServersSource` (:70-78) lacks. **Recommended design:** move `CLONE_KEY`, `cloneKeyOf`, `isPathMarketplace`, `owningRoot`, and `isContained` from builtin-registration-step.ts into recorded-servers.ts. Fallow dupes forbids a copy. Add `locations: ScopedLocations` to `LegacyServersSource`, and have `createLegacyServersReader` refuse with a new private reason `"uncontained"` before any read. The registration step then relies on the reader (or keeps calling the shared function first, so its "not registered: its plugin root is outside its sources" debug line stays). Thread `locations` through the 9 call sites. Each has a `locations` in scope or one step away (args.locations, options, context, input). Tests: recorded-servers.test.ts (symlink, `..`, wrong clone key, outside cases as in builtin-registration-step.test.ts:486-631) and the callers' tests where the source shape changes. This touches `update-swap.ts` and `update-swap.test.ts`, so it **must follow** the P4-DC-60 plan.
**Smaller alternative:** pass only `pluginClonesDir` and `sourceCloneDir`. It is the same threading cost. The severity is low (only classification reaches a row), so the planner may scope UF-1 to "contain, refuse → `unreadable` → stored verdict stands" with no new message.

### 5.7 01-FROZEN.md text

- Interface 3 (`.planning/phases/01-foundation-and-pi-1-5-0/01-FROZEN.md:258-260`): "An install writes a new record without the basis." → "An install writes `compatibilityBasis: \"neutral\"`" `[VERIFIED: orchestrators/plugin/install-outcome.ts:1671 compatibilityBasis: "neutral",]` (D-P3-02).
- Interface 5 (:290-324) also lacks the 04-06 item 3 text: `agentGrantsStep(input: AgentGrantsStepInput, env: SubagentChildEnv = process.env): Promise<void>` and `createLoadReconcile(reader, applyReconcile, env: SubagentChildEnv = process.env)`. Apply it in the same edit. It is a planning doc, so no build input.
- §3 "Fallow entries that Phase 6 removes" (:473-503): add a closing line once 4 lands.

### 5.8 P2-DC-77: stand-in wait (D-P6-11)

`[VERIFIED: features/lib/turn-records.ts:79-88]` `assertStandInsStopped` reads pid files and asserts none run, **at once**. Callers: `world.ts:661` (restart) and `:899` (release). A poll already exists: `waitUntilProcessesExit(pids, timeoutMs)` (features/lib/mcp-implementation.ts:399-416, POLL_MS 50), used by the shared-Pi reset with `STUB_EXIT_TIMEOUT_MS = 10_000` (support/pi-process.ts:92, :244). **Change:** have `assertStandInsStopped` poll up to a bounded time (the reset's 10 s is the precedent) before it fails. Implement the poll inside turn-records.ts. `mcp-implementation.ts` imports `isRunning` from turn-records.ts (:47), so importing back would form a cycle that fallow's cycle gate fails. Then retag `features/mcp-server/lifecycle.feature:395-405` "A new session offers the plugin's tool again (BLT-01)" from `@adapter-only` to `@mcp`, delete the comment at :391-394, run it under both profiles, and if it passes, close WINDOWS row 112 (`gsd-tools windows fixed 112`).

Why it should work: the orphan stub is a child of Pi with a stdin pipe from Pi, so it exits when Pi exits (the 02-06 analysis). Duplicate connections do not rename tools, because the tool owner is `server\0tool` (index.js:300-306). **Risk:** the scenario's `pi offers these plugin mcp tools` could still differ under built-in, or the leak could persist past 10 s. Then keep `@adapter-only`, leave WINDOWS 112 open, and hand the BACKLOG entry with the drafted upstream report to the records plan: RPC `new_session` emits `session_start` twice (`dist/modes/rpc/rpc-mode.js` with `AgentSessionRuntime.finishSessionReplacement`), and `dist/extensions/mcp/index.js:971` `session_start` does not close an earlier session_start's connections. Known flake: lifecycle.feature:396 under the adapter profile under load (P3-DC-111). Rerun it once.

### 5.9 Already applied on the combined tree (do not redo)

| Parent line | Evidence |
|-------------|----------|
| P1-DC-33 features/lib + pi-api.ts ignoreExports | commit `13ce40a`; absent from .fallowrc.json |
| 04-06 item 1 verdict-markers built-in text | verdict-markers.feature:334 has "a launch before Pi's built-in MCP has listed the server's tools still fails" |
| 02-04/02-08 item 7 info.test.ts `plugin_alpha_srv` | test/orchestrators/plugin/info.test.ts:8271 `builtin: statusSnapshot([{ name: "plugin_alpha_srv", status: "failed" }])` |
| 02-04 companion-missing.feature:76 `not loaded` | moot: Phase 3 replaced that scenario. Today :76-78 is the elicitation install row, and the no-implementation info row correctly shows `status unknown` (:134) |
| 03-06 `PluginConvergeTarget.mcpImplementation` | orchestrators/types.ts:731; `1178bd7` |
| 02-05 project-scope.feature description | 02-08 item 15: no change needed |
| REQUIREMENTS traceability for Phase 2's 11 IDs | REQUIREMENTS.md:156-171, 180 already `Complete` (MSEL-02..04, MREC-02, BLT-01..06, MDOC-01) |
| 04-06 item 2's "add implementation field" | the field exists, only the repoint remains (5.1) |

## 6. Records (D-P6-12..15)

**BACKLOG.md format** (`.planning/BACKLOG.md`, 4883 lines, newest last at :4881): `## <ID-NN>: <title>`, then one paragraph that starts "Added 2026-11-04 (mcp-builtin, <source IDs>)." or "Noted ...". Entries to add (one each, with source ID; propose IDs):
1. MCPV2-01 immediate register/unregister (D-MB-10, 01-14).
2. MCPV2-02 deny rules → `toolExposure: "hidden"`.
3. MCPV2-03 background children calling plugin MCP tools under built-in.
4. Deny-list re-pin to Claude Code 2.1.318 (P2-DC-22).
5. BLT-04 load-time notice for an overridden or refused built-in registration (P2-DC-08).
6. Fallback when `tool_search` is off (02-08 item 4d).
7. Info telling another extension's same-name registration apart (P2-DC-46, needs the frozen `createBuiltinMcpStatusReader` param).
8. ToolSearch naming in hooks (P5-DC-09, P5-DC-35).
9. `details.tool` recovery (05-CONTEXT deferred).
10. Both-loaded proxy hardening (T-05-07, P5-DC-15).
11. Matcher parity gaps (P5-DC-16).
12. No-implementation hook scenario (P5-DC-24).
13. pending/apply disagreement (P3-DC-122, text at 06-PARENT-LINES.md:205).
14. Exact legacy grant translation (P4-DC-06, P4-DC-30).
15. Grants-step load warning (P4-DC-09, P4-DC-32).
16. P2-DC-77 RPC double `session_start`, only if 5.8 fails, with the drafted report.
17. Phase 1 conditionals: (a) info `requires:` while an implementation runs every server: **settled** by Phase 3 (soft-dep table, names `runEvery` set, not missing), no entry. (b) load warning row for a plugin that becomes partial after a switch: check before writing. (c) built-in status `not loaded` vs `not connected`: settled by P2-DC-10 (status table). (d) first built-in session and a legacy `mcp.json` entry: documented by P2-DC-11 (mcp-compatibility.md:213-215). Write an entry only for an item still open, and record the disposition of each in the SUMMARY.
18. Optional: if P3-DC-22 is cut down, its remainder.

**PROJECT.md** (`.planning/PROJECT.md`): Key Decisions table header at :1582. Row form: `| **<ID> (mcp-builtin, Phase N, settled autonomously, pending user review, DUBIOUS-CHOICES <P-DC>): <decision>**. <detail> | <rationale> | -- Pending |`, as in D-MB-08..13 at :1990-1995. Rows to add:
- Phase 3 (03-09 addendum, 06-PARENT-LINES.md:206): the neutral stored verdict (P3-DC-01/02/15), the D-MB-07 marker table and `requires:` naming (P3-DC-05/07), consent per active implementation with record-driven sites on the neutral view (P3-DC-09/10/20), the user-run `update` keeps today's consent rules (P3-DC-112). IDs: 03-CONTEXT has D-P3-01..23. Use those IDs or mint D-MB-NN, and state which.
- Phase 5 (05-04 item 4, drafted text at 06-PARENT-LINES.md:296-298): D-P5-01..03 (hook-facing name), D-P5-04 (matching), D-P5-06/07 (proxy rule scope). Rows or D-MB-08 detail.
- D-MB-03 (:1985) and D-MB-12 (:1994) "Implemented by Phase 4" text (06-PARENT-LINES.md:250, verbatim).
- D-MB-14+ for P2-DC-90 (proposed mapping, which the docs plan must use too): D-MB-14 P2-DC-02 (resolved values visible to every extension, amends D-MB-04), D-MB-15 P2-DC-04 (no `cwd`), D-MB-16 P2-DC-05 (`timeout` ms/1000, no rounding), D-MB-17 P2-DC-08 (overrides/refusals in `info` only, no load notice), D-MB-18 P2-DC-10 (status from Pi's tool list), D-MB-19 P2-DC-13 (containment root), D-MB-20 P2-DC-14 (project record wins per server name), D-MB-21 P2-DC-20 (`callbackUrl` only with `callbackPort`), D-MB-22 P2-DC-46 (another extension's registration). The docs also cite **P2-DC-03, -07, -11, -15, -21, -22, -23** (`grep -oh "P[0-9]-DC-[0-9]*" docs/*.md`: 16 distinct IDs, all in mcp-compatibility.md). P2-DC-90's reason (review-log IDs go stale) applies to them too. Either mint D-MB-23..29, or leave them as cited review IDs (dubious).
- D-CF1-16 (:1893) rationale: append the Phase 6 measurement sentence (form at 01-CI-HANDOFF.md:96-104).
- D-MB-08..13 stay `-- Pending`.
- "Last updated" line (latest at :2018): add a new line on top.
- Validated: Phase 1 precedent records verified IDs in the Last-updated line. The 03-09 addendum asks to "move MREC-03..07 to Validated with 'Phase 3 (mcp-builtin)'". Follow one form consistently. Milestone archive happens at `/gsd-complete-milestone`.

**REQUIREMENTS.md:** only DUAL-04 (:123, :179) and MDOC-02 (:128, :181) are `Pending`. The phase completion tool flips them. Do not hand-edit (tool-written, ROADMAP milestone rules).

**Codebase maps** (`.planning/codebase/`): STRUCTURE.md, ARCHITECTURE.md, CONVENTIONS.md, STACK.md, TESTING.md exist. None mentions `orchestrators/mcp/`, `mcp-implementation`, `subagent-child`, `grant-rewrite`, `mcp-tool-view`, `builtin-mcp-tool-names`, `recorded-servers`, or `mcp-verdict` except the fallow-entry lines. New product modules this milestone (`git diff --name-status bdbb5f2 HEAD -- extensions | grep ^A`): bridges/agents/{grant-forms,grant-rewrite,legacy-grant-form,mcp-async-warning}.ts; bridges/hooks/mcp-tool-view.ts; bridges/mcp/{builtin-description,builtin-entry,builtin-escape,builtin-overrides,builtin-registration}.ts; domain/components/hooks/builtin-mcp-tool-names.ts; domain/{mcp-builtin-features,mcp-builtin-translation,mcp-implementation}.ts; orchestrators/mcp/{agent-grants-step,builtin-registration-step,recorded-servers,session-materialize}.ts; orchestrators/plugin/{mcp-verdict-read,mcp-verdict}.ts; platform/{mcp-builtin-status,subagent-child}.ts. Drafted edits: 04-06 item 9 (06-PARENT-LINES.md:256-259), 05-04 item 6 (:306-308), 02-01 (`unbound-method` disables), 02-03 (count 45, five loader extensions). The zones are unchanged: no new top-level directory. `orchestrators/mcp/` falls under the `orchestrators` zone.

**Cucumber skill (frozen `.agents/skills/cucumber/**`, none applied yet):**
- `rules/world-and-stand-ins.md` "MCP implementations" (:57) or "Stand-ins of the profile Pi" (:114): name `features/lib/mcp-builtin-config-probe/` beside the registry probe (P2-DC-24).
- "The scripted model" (:90-97): the profile-aware call-step exception (verbatim at 06-PARENT-LINES.md:292).
- "Stand-ins of the profile Pi" (:114): the `hook-mcp-tool-server.ts` and `mcp.json` step entry (verbatim at :293).
- `rules/layout.md:78` hooks paragraph: "the stub MCP server `Given` steps, the profile-aware MCP call step, and the `mcp.json` step".
- If P2-DC-18 lands: world-and-stand-ins.md:97/:102 can name `upstream/tool-search.ts`.
- `rules/layout.md:95`'s harness list: add `mcp-builtin-config-probe/**` if it is frozen harness. Check against ROADMAP.

**Root dubious-choices log (D-P6-14):** `git mv .planning/DUBIOUS-CHOICES.md .planning/milestones/component-features-DUBIOUS-CHOICES.md`. Today it starts "# component-features: Dubious Choices Log". Then write the new root log from the parent's working log `/tmp/claude-0/-home-user-pi-claude-marketplace/bd012ee2-49d5-5eae-bcde-ad28ca160602/scratchpad/QUESTIONABLE-CHOICES.md`. It carries S-NN session entries, the P1..P5 entries, and 2 `P6-PRE` mentions. The scratchpad dies with the container, so this commit is the durable copy. Phase logs: 01 (40 entries), 02 (101), 03 (131), 04 (82), 05 (42) per heading count, plus 06's P6-DC-01..09 and this research's entries. "Decisions waiting on you" leads with the High items (P4-DC-60 is High, P2-DC-02 is High).

**WINDOWS:** `gsd-tools windows append --description "[mcp-builtin] ..."` for any new deviation. Close row 112 with `windows fixed 112` only if 5.8 passes.

## 7. CI timing (D-P6-16)

`.github/workflows/ci.yml:119-173`: job `behavioral`, name `behavioral tests, ${{ matrix.profile }} ${{ matrix.shard }} (Node 24)`, `timeout-minutes: 15` (:133). Matrix legs: `adapter`/`lifecycle` (`features/marketplace features/plugin`), `adapter`/`components` (the six function directories), `builtin`/`all` (`features`). The step is `Run the behavioral tests` (:170), env `PROFILE`, `SHARD_PATHS`. `test/architecture/behavioral-shard-coverage.test.ts` guards the shards.

D-CF1-16 (PROJECT.md:1893). The decision says "Each leg's timeout is at least 1.5 times its measured run and never below 15 minutes." The last measurement was run 41812979607, head 8d03f4e: lifecycle 3m24s, components 4m08s, builtin 1m19s, "so `timeout-minutes` stays at 15". **Conflict:** D-P6-16's "changes only if a leg uses more than 80%" is looser than D-CF1-16's "≥1.5× the measured run" (that is, ≤66.7% use). A leg of 10.5 to 12 minutes satisfies D-P6-16 and violates D-CF1-16. **Recommendation:** the handoff applies D-CF1-16's rule, which is the recorded decision, and notes D-P6-16's threshold as superseded. Flagged as dubious.

**Handoff file** (the last task; form: `.planning/phases/01-foundation-and-pi-1-5-0/01-CI-HANDOFF.md`): the gate commit sha and its `npm run check` and `test:modules` results with the Node version; the build-input check `git diff <gate sha> <head> -- . ':(exclude,glob).planning/**/*.md'` (must be empty); local cucumber wall times per leg path set with scenario counts and seeds; the three leg names as ci.yml builds them; the checklist (push `features/mcp-builtin`, never force, never `main`; dispatch `ci.yml` via `workflow_dispatch`, since there is no `features/**` push trigger; confirm head sha; record job and step durations via `gh run view <id> --json jobs`; apply the timeout rule; amend D-CF1-16; fill an `## CI timings` section, in 06's handoff or 01-FROZEN.md); the known flakes (lifecycle.feature:396, P3-DC-111; TUI readiness with a cold `/tmp/jiti`); and the required-status-check names note (P1-DC-36).

## Architecture Patterns

### Plan split (recommended; parallel plans never share a file)

| Wave | Plan | Owns (files) | Depends |
|------|------|--------------|---------|
| 1 | A: DUAL-04 row + red proof | features/mcp-server/implementation-switch.feature | — |
| 1 | B: P4-DC-60 | orchestrators/plugin/update-swap.ts, test/orchestrators/plugin/update-swap.test.ts, features/mcp-server/agent-grants.feature | — |
| 1 | C: P3-DC-22 | edge/register.ts, orchestrators/edge-deps.ts, shared/completion-cache.ts (+ classifier helper if any), their tests, features/lib/plugin-completions.ts, features/step_definitions/completion.steps.ts, one verdict feature file (e.g. verdict-list.feature) | — |
| 1 | D: small lines | bridges/mcp/substitute.ts, test/bridges/mcp/substitute.test.ts, test/integration/adapter-expansion-conformance.test.ts, test/architecture/manifest-read-agreement.test.ts, features/lib/mcp-builtin-tool-search.ts→upstream/tool-search.ts, features/step_definitions/mcp-server/builtin-tool-search.steps.ts | — |
| 1 | E: P2-DC-77 | features/lib/turn-records.ts, features/mcp-server/lifecycle.feature (WINDOWS via tool) | — |
| 1 | F: README/compat docs | README.md, README.es.md, docs/hooks-compatibility.md, docs/mcp-compatibility.md (agents text + D-MB-14+ citations by the fixed mapping) | — |
| 1 | G: catalog docs | docs/output-catalog.md, docs/json-output.md, test/architecture/catalog-uat/fixtures/plugin-info.ts, test/architecture/catalog-uat/catalog-contract.test.ts | — |
| 2 | H: UF-1, UF-4, fallow, exports | orchestrators/mcp/recorded-servers.ts(+test), builtin-registration-step.ts(+test), mcp-verdict-read.ts(+test), the 9 caller files and their tests as needed, .fallowrc.json, 01-FROZEN.md | B (update-swap) |
| 3 | I: piMcpAdapterLoaded | platform/pi-api.ts + the 34 test files (`git grep -l`) | B, H (shared test files) |
| 3 | J: records 1 | CHANGELOG.md, .planning/PROJECT.md, .planning/BACKLOG.md | A-H outcomes |
| 3 | K: records 2 | .planning/codebase/*.md, .agents/skills/cucumber/rules/*.md, .planning/DUBIOUS-CHOICES.md (+ git mv) | H (counts) |
| 4 | L: combined gate | per-feature re-verify table (D-P6-06), `npm run check`, `test:modules`, both profiles, dupes, CI handoff file | all |

Waves 1 and 3 run plans in parallel executor worktrees. Each wave ends with the post-merge gate `npm run check` on the combined tree (local-verification gates.md). If the parent budget is tight, merge D and E, and J and K.

### Anti-Patterns to Avoid
- **Keeping an `ignoreExports` entry "for later":** fallow never reports an `ignoreExports` name as stale, so it hides a future true positive (13ce40a message).
- **Exporting `LegacyServersUnreadableError` for the test:** forbidden. Assert through `createLegacyServersReader`.
- **Copying `owningRoot`/`isContained` into recorded-servers.ts:** `fallow dupes` fails on every clone group. Move the code.
- **Importing `mcp-verdict-read.ts` from `plugin-state-classifier.ts` / `git-source-probe.ts`:** this forms a cycle (mcp-verdict-read.ts:12-16).
- **Hand-editing REQUIREMENTS/ROADMAP/STATE/WINDOWS:** these are tool-written.
- **A catalog doc commit without the fixture literal and the counter:** `test:unpaired` fails.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path containment for UF-1 | a new `startsWith` check | `assertPathInside` (shared/path-safety.ts) + the moved `owningRoot` | symlink and `..` handling, NFR-10 chokepoint |
| Redaction for UF-4 | a regex | `redactAbsolutePaths` (shared/redact-absolute-paths.ts) | already used by the sibling step |
| Process-exit polling | a new loop with a cycle | a local bounded poll in turn-records.ts modeled on `waitUntilProcessesExit` | no import cycle |
| Run snapshot at completion | a new probe | `openNotificationSnapshot(pi)` | the single probe |
| Window close | editing WINDOWS.md | `gsd-tools windows fixed <id>` | tool-written |

## Runtime State Inventory

This is not a rename or migration phase. One state-shape item is relevant:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Completion cache files `<scope>/pi-claude-marketplace/.../plugin-cache` (schemaVersion 6) keyed by marketplace only | P3-DC-22: key by implementation, or stamp it in the file. Old files expire by the 10-min TTL, or get a version bump |
| Live service config | None. Verified: no external service config | none |
| OS-registered state | None | none |
| Secrets/env vars | None (`PI_SUBAGENT_CHILD` unchanged) | none |
| Build artifacts | `/tmp/jiti` / run-root `jiti-cache` compile cache (TUI flake source) | none; known flake |

## Common Pitfalls

### Pitfall 1: Catalog byte counter drift
**What goes wrong:** editing the rendered `requires:` lines without updating `EXPECTED_UTF8_BYTES`. **Avoid:** recompute (−11 bytes per `pi-mcp-adapter`→`mcp`), and run `npm run test:unpaired` on the commit. **Warning sign:** a `catalog-contract` assertion at :300.

### Pitfall 2: Fixture order versus rendered order
The renderer formats `requires` in the literal's order. Change the every-companion literal's order to match the new sorted line.

### Pitfall 3: The switch scenario is adapter-only
`@own-implementation` is excluded from the builtin profile. Do not claim a builtin red proof for DUAL-04.

### Pitfall 4: `updateAgentImplementation` tests passing for the wrong reason
The direct-swap built-in test sets only `run`. After the repoint it needs `mcpImplementation: "builtin"`, or it will report the adapter form.

### Pitfall 5: Shared test support in a commit
Removing `piMcpAdapterLoaded` touches `test/shared/notification-run-seeds.ts` and `install-flow-fixture.ts`, so the hook runs every pair's coverage (long). Run it in the background, inside the 10-minute Bash cap.

### Pitfall 6: Completion cache file serving stale statuses after a switch
This happens if only the memory key changes (5.2).

### Pitfall 7: Known flakes
lifecycle.feature:396 (adapter, under load) and TUI readiness with a cold jiti cache. Rerun once, and record both attempts.

## Code Examples

DUAL-04 rows: §2. P4-DC-60 change: §5.1 (`return args.mcpImplementation;`). Catalog literal change (plugin-info.ts:85-88):
```ts
          requires: [
            { companion: "mcp", missing: true },
            { companion: "pi-subagents", missing: false },
          ],
```
Every-companion (plugin-info.ts:113-117):
```ts
          requires: [
            { companion: "mcp", missing: false },
            { companion: "pi-dynamic-workflows", missing: true },
            { companion: "pi-subagents", missing: false },
          ],
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `piMcpAdapterLoaded` gates the MCP marker | `mcpImplementation` + `MCP_NAME_TABLE` | Phase 3 | the field is dead in production |
| One `requires pi-mcp-adapter` marker | three markers (D-MB-07) | Phase 3 | docs/catalog must say so |
| Frozen-module fallow entries | consumers exist | Phases 2-4 | remove the entries |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The DUAL-04 `list` result fields are severity `info`, 0 warnings, `Plugin list` | §2 | The first run shows the true values; adjust the table |
| A2 | Waiting ≤10 s lets the leaked built-in stub exit after Pi stops | §5.8 | The scenario stays `@adapter-only`; BACKLOG entry |
| A3 | The neutral completion view classifies an sse-only plugin `available` | §5.2 | The red proof scenario must pick another case; verify on the red run |
| A4 | Optional elicitation wording in hooks-compatibility.md:33/:101 | §1.1 | Wording only |
| A5 | Every caller of `readRecordMcpVerdict`/`readRecordMcpDependency` can reach `ScopedLocations` cheaply | §5.6 | UF-1 grows; consider the scoped-down variant |

## Open Questions (RESOLVED)

1. **Is `/claude:plugin list` a "plugin command" under DUAL-04?** Recommendation: no (read-only, NFR-5). Add a comment and consider retitling. User review. RESOLVED: D-P6-18 (one read-only `list` read for the `{requires mcp}` row).
2. **The 7 extra `requires: pi-mcp-adapter` catalog blocks.** Recommendation: change them to `mcp` in the same commit (−77 more bytes). RESOLVED: D-P6-19.
3. **Mint D-MB IDs for P2-DC-03/07/11/15/21/22/23 too?** Recommendation: yes, D-MB-23..29, so the docs cite no review-log ID. RESOLVED: D-P6-24.
4. **CI timeout rule: D-CF1-16 (1.5×) or D-P6-16 (80%)?** Recommendation: D-CF1-16. RESOLVED: D-P6-25.
5. **The 02-08 item 5 catalog example blocks as new catalog states?** Recommendation: prose and table only. RESOLVED: D-P6-26.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | ✓ | v24.22.1 | — |
| npm | scripts | ✓ | 10.9.9 | — |
| git (worktree) | DUAL-04 red proof | ✓ | 2.43.0 | — |
| python3 | `features/lib/pi-tui-pty.py` (TUI scenarios) | ✓ | 3.13.18 | — |
| pre-commit | docs commits (mdformat, markdownlint) | ✓ | 4.7.0 | — |
| setpriv non-DAC shell | npm scripts as root | ✓ | `/tmp/claude-0/-home-user-pi-claude-marketplace/bd012ee2-49d5-5eae-bcde-ad28ca160602/scratchpad/nondac-sh` | — |
| Optional peers cache (pi-mcp-adapter 7.0.0 etc.) | cucumber | ✓ | node_modules/.cache/optional-peers | `node scripts/install-test-peers.mjs` |
| GitHub tools (`gh`, push) | CI dispatch | ✗ for executors | — | parent session does it (D-P6-16) |
| CPUs | cucumber `parallel: 8` | 4 | — | longer wall times |

**Missing with fallback:** GitHub access goes through the parent. The handoff file carries it.

## Validation Architecture

Environment prefix for every npm/cucumber command (container runs as root):
`npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/bd012ee2-49d5-5eae-bcde-ad28ca160602/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. Below it is `$ENV`. A Bash call caps at 10 minutes, so run `npm run check`, `test:modules`, full cucumber profiles, and `test:coverage:direct:all` with `run_in_background` and wait on completion. Never run two heavy gates at once in one checkout.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (unit/architecture/integration) + cucumber-js (profiles `adapter`, `builtin`) |
| Config file | `cucumber.json`, `package.json` scripts, `.fallowrc.json` |
| Quick run command | `$ENV node --test <test-path>`; `$ENV npx cucumber-js --profile <p> --name '<title>' <feature>` |
| Full suite command | `$ENV npm run check` (static + unpaired + integration + both cucumber profiles + direct coverage), plus `$ENV npm run test:modules` at the phase gate |

### Phase Requirements → Test Map
| Req / SC | Behavior | Type | Automated Command | File Exists? |
|----------|----------|------|-------------------|-------------|
| DUAL-04 / SC2 | switch: adapter reach → `{requires mcp}` (built-in off) → built-in reach → adapter reach | cucumber (adapter profile only) | `$ENV npm run test:cucumber:profile -- --profile adapter features/mcp-server/implementation-switch.feature` | ✅ (row added) |
| DUAL-04 red | the new row fails at d1711fd | cucumber in worktree | §2 procedure (`npx cucumber-js --profile adapter --name ...`) | worktree |
| MDOC-02 / SC1 | docs describe built-in, markers, naming, adapter adds | **manual review** + mechanical: `pre-commit run --files CHANGELOG.md README.md README.es.md docs/*.md`; grep checks, e.g. `grep -c "requires builtin mcp" README.md README.es.md` ≥1, `grep -n "55" docs/hooks-compatibility.md` | partial |
| MDOC-02 catalog | catalog blocks match fixtures | unit (unpaired) | `$ENV npm run test:unpaired` | ✅ |
| SC3 fallow | no unreviewed clone group; dead-code clean after entries removed | static | `npx fallow dupes`; `$ENV npm run fallow` | ✅ |
| SC3 gate | combined tree green | full | `$ENV npm run check` and `$ENV npm run test:modules` (background) | ✅ |
| SC3 CI | legs within timeouts | **manual (parent)** | handoff checklist; `gh run view <id> --json jobs` | handoff file |
| SC4 closed sets | six entries kept with emitters | static evidence + locks | `$ENV node --test test/architecture/notify-closed-set-locks.test.ts` | ✅ |
| SC4 records | parent lines applied / backlogged, root log merged | **manual review** + `git diff --stat` | — | — |
| D-P6-06 | per-feature re-verify | cucumber | `$ENV npm run test:cucumber:profile -- --profile adapter features/mcp-server/builtin-status.feature features/hook/mcp-tool-names.feature features/hook/tool-use.feature features/mcp-server/agent-grants.feature features/mcp-server/implementation-switch.feature` and the same with `--profile builtin` (minus the switch file, which the builtin profile excludes) | ✅ |
| P4-DC-60 | apply converge stages built-in grant | unit + cucumber (builtin) | `$ENV node --test test/orchestrators/plugin/update-swap.test.ts`; `$ENV npm run test:cucumber:profile -- --profile builtin features/mcp-server/agent-grants.feature` | ✅ (new scenario) |
| P3-DC-22 | completions follow implementation | unit + cucumber pair | `$ENV node --test test/edge/register.test.ts test/shared/completion-cache.test.ts test/orchestrators/edge-deps.test.ts`; profile runs on the chosen feature | Wave 0: new scenario pair |
| P2-DC-53 | encoder required | integration + unit | `$ENV npm run test:integration` (or `node --test test/integration/adapter-expansion-conformance.test.ts`); `node --test test/bridges/mcp/substitute.test.ts`; `npm run typecheck` | ✅ |
| MANF-01 | five readers agree | architecture | `$ENV node --test test/architecture/manifest-read-agreement.test.ts` | ✅ |
| P2-DC-18 | step still binds | dry run | `$ENV npm run check:features` | ✅ |
| P2-DC-77 | BLT-01 new session under both | cucumber | `$ENV npx cucumber-js --profile builtin --name "A new session offers the plugin's tool again" features/mcp-server/lifecycle.feature` (×3 for flake) | ✅ |
| UF-1/UF-4 | containment refusal, redacted log | unit | `$ENV node --test test/orchestrators/mcp/recorded-servers.test.ts`; pair coverage `$ENV npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts` | ✅ |
| D-P6-09 | field gone, behavior same | typecheck + all pairs | `$ENV npm run typecheck`; `$ENV npm run test:coverage:direct:all` (background) | ✅ |

### Sampling Rate
- **Per task commit:** the owner test(s) plus the commit hook (`check:commit`, staged pairs). The catalog commit adds `npm run test:unpaired`. Cucumber tasks run their feature under each applicable profile.
- **Per wave merge:** `$ENV npm run check` on the combined tree (background). After wave 2, also `$ENV npm run fallow` (cheap, run first).
- **Phase gate:** `$ENV npm run check` + `$ENV npm run test:modules` + the D-P6-06 per-feature table + `npx fallow dupes`, all green on one commit. Reuse evidence only per local-verification gates.md. Then write the CI handoff.

### Wave 0 Gaps
- [ ] New scenario: `@builtin-only` apply-converge grant (agent-grants.feature), written red first.
- [ ] New scenario pair: completions per implementation (P3-DC-22), with the harness implementation parameter.
- [ ] New gate half: `readBuiltinServerDescription` in manifest-read-agreement.test.ts.
- [ ] New unit cases: UF-1 refusal shapes, UF-4 redaction, update-swap cascade with `mcpImplementation: "builtin"`.

## Security Domain

Security enforcement is enabled (config has no `security_enforcement: false`).

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes (file containment) | `assertPathInside` (NFR-10), UF-1 |
| V5 Input Validation | yes (state.json `resolvedSource` is `Type.String()`) | containment before read; typebox validators |
| V6 Cryptography | no | — |
| V7 Logging | yes (UF-4) | `redactAbsolutePaths` on the debug channel |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hand-edited `resolvedSource` points the legacy re-resolution outside the clone root | Information disclosure / Tampering | UF-1 containment refusal → `unreadable` → stored verdict stands |
| Absolute path in an opt-in debug line | Information disclosure | UF-4 redaction |
| Completion cache file across implementations | Tampering (stale data) | key or stamp by implementation |

## Sources

### Primary (HIGH confidence)
- In-repo files read this session (cited with lines above): `.fallowrc.json`, `shared/concerns/soft-dep.ts`, `shared/notification-wire.ts`, `orchestrators/mcp/recorded-servers.ts`, `orchestrators/mcp/builtin-registration-step.ts`, `orchestrators/plugin/{update-swap,update-flow,mcp-verdict-read,list-candidate-row,info-mcp-status}.ts`, `orchestrators/edge-deps.ts`, `edge/register.ts`, `shared/completion-cache.ts`, `bridges/mcp/{substitute,builtin-description}.ts`, `platform/pi-api.ts`, `features/**` (switch, companion-missing, verdict-*, agent-grants, lifecycle, support/world.ts, lib/turn-records.ts, lib/mcp-implementation.ts, lib/plugin-completions.ts, lib/upstream/index.ts), `test/architecture/catalog-uat/{catalog-contract.test.ts,fixtures/plugin-info.ts}`, `docs/*.md`, README*.md, CHANGELOG.md, `.planning/{PROJECT,REQUIREMENTS,ROADMAP,BACKLOG}.md`, `01-FROZEN.md`, `01-CI-HANDOFF.md`, `01/02-SECURITY.md`, `.agents/skills/{readme,changelog,local-verification,typescript-unit-tests,cucumber}`.
- Pi 1.5.0 source: `node_modules/@earendil-works/pi-coding-agent/dist/extensions/mcp/tools.js:29,45-51`, `index.js:285-313,971`.
- pi-mcp-adapter 7.0.0 source: `node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/dist/types.js:116-143`.
- Tool runs: `npx fallow dead-code` probe and `--trace` ×4 (temp config), `npx fallow dupes --no-cache`, `rg` marker counts, `git grep` counts, `git diff --stat d1711fd HEAD` on build inputs.

### Secondary / Tertiary
- None. No web sources were needed.

## Metadata

**Confidence breakdown:**
- Docs inventory: HIGH (every line read)
- Closed sets / fallow: HIGH (emitters read, fallow probe run)
- Code changes: HIGH for the location and shape, MEDIUM for P3-DC-22 and UF-1 effort
- DUAL-04: HIGH (harness read; red-proof tree verified to contain the scenario)
- P2-DC-77 outcome: MEDIUM (A2)

**Research date:** 2026-11-04
**Valid until:** until the next merge into `features/mcp-builtin` (line numbers shift).
