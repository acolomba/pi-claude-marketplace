# Phase 4: Agent Grants - Research

**Researched:** 2026-11-04
**Domain:** pi-subagents agent files (MCP grant form per MCP implementation), load-time rewrite under the state lock, background-child detection, dual-profile cucumber harness
**Confidence:** HIGH (every code fact below was read this session; the pi-subagents refusal texts were reproduced end to end in a scratch cucumber run)

## Summary

Phase 4 changes three places. First, the agents bridge renders each agent for both MCP implementations. The file gets the form of the active implementation, or the adapter form when no implementation is active. The agents-index row stores both rendered frontmatter blocks when they differ. Second, the frozen seed `orchestrators/mcp/agent-grants-step.ts` swaps the frontmatter block of each agent file whose recorded form differs from the active implementation. It does this at `session_start`, under the scope's state lock, and only when the file still holds the recorded form. Third, `isSubagentChild(env)`, a new pure leaf in `platform/subagent-child.ts`, gates the grants step. It also gates the load reconcile's autoapply step and its AMIG-01 MCP move.

All the inputs exist already. `profileFor(id)` gives `grantSelector`, `toolName`, and `classify` (frozen, `domain/mcp-implementation.ts:28-142`). `agentsPhase` and `ThreePhaseArgs` already carry `resolved.declaredMcpServers`, `resolved.mcpServers`, and the run snapshot `run.softDeps.mcpImplementation`. One gap matters: the **cascade** update paths (marketplace autoupdate, `apply`'s catalog convergence, dependency moves) build a `CascadeThreePhaseArgs`, which has `run?: never` (`update-swap.ts:290-294`). So the update agent staging cannot read the active implementation there, unless a dependency move carries `preflightNotification.run`. The planner must pick a fallback for those paths (see Open Question 1). The recommendation is "none, so the adapter form, and the next load fixes it". It needs no edit outside Phase 4's own function.

This session's scratch cucumber probes measured the exact pi-subagents 0.84.0 results the scenarios will see under the builtin profile. They used Pi 1.5.0, pi-subagents 0.84.0, and the Phase 1 stand-in. Today an installed agent shows `tools mcp:plugin_demo_stub_/echo`, and its foreground launch projects to `error naming plugin_demo_stub_/echo` ("does not offer"). With the built-in form, the launch is refused as "servers that extensions registered (plugin_demo_stub)". Today that refusal projects to a bare `error`, so `features/lib/upstream/subagents.ts` needs the new pattern given below.

**Primary recommendation:** Render the forms in the bridge (`prepareStagePluginAgents` calls a per-implementation conversion twice when the plugin declares MCP servers). Store `mcpImplementation` plus `mcpForms.{adapter,builtin}.{frontmatter,warnings,droppedTools}` on the row. Put the file rewrite in a new `bridges/agents/` module that the step calls inside `withLockedStateTransaction(..., { persistMigration: false })`. Read `PI_SUBAGENT_CHILD` lazily, at event time, from an injected `env` whose default is `process.env`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Research answers (ROADMAP discuss and research flags)

- **Built-in grant syntax (P1-DC-28 closed).** pi-subagents 0.84.0 resolves
  `mcp:<server>` and `mcp:<server>/<tool>` against Pi's built-in MCP when the
  `mcp` command comes from `builtin:mcp` and no `mcp-adapter` command exists
  (`bundle/chunk-V2BZYLEP.js` `usesBuiltinMcp`, `resolveBuiltinMcpSelections`).
  A whole-server selector matches every tool whose namespace is
  `mcp__<server with - folded to _>`; a per-tool selector matches the tool Pi
  names `mcp__<server>__<tool>` sanitized (`builtinMcpToolNames`, the same
  rule as Pi 1.5.0 `createMcpToolName`, long-name hash included). So the
  frozen built-in `grantSelector`, `mcp:<builtinMcpServerName(plugin, server)>`,
  is correct as built, with `-` kept. No parent line.
- **What shows that a grant resolved.** Two things pi-subagents reports,
  neither of which needs a background launch:
  1. `subagent {"action":"get","agent":...}`: the agent detail's `tools`
     line, which pi-subagents reads from the file (`mcp:plugin_demo_stub_/echo`
     under the adapter, `mcp:plugin_demo_stub/echo` under built-in).
  2. The D-CF6-10 foreground refusal. Under the adapter it names the adapter
     selector (`error naming plugin_demo_stub_/echo`, pinned today). Under
     built-in, a resolved grant is refused because the server is registered
     by an extension: "Agent 'demo:runner' selects MCP tools from servers
     that extensions registered (plugin_demo_stub). Only background children
     (async: true) load those extensions; ..." (`chunk-JG4QKI5M.js`
     `buildInProcessChildLaunch`). An unresolved built-in grant (the adapter
     form under built-in) fails earlier with "selects MCP tools that Pi's
     built-in MCP does not offer: mcp:plugin_demo_stub_/echo". The difference
     between the two texts is the red proof under the built-in profile.
  A background launch is not used: the harness's background children load
  neither the companions nor the scripted model (MCPBG-01), and background
  agents calling plugin MCP tools under built-in are v2 (MCPV2-03).
- **Stand-in or Phase 2.** Every built-in leg uses the Phase 1 stand-in
  server (`a stand-in registers the stub mcp server ... with pi's built-in mcp`),
  which registers through `pi.registerMcpServer` like Phase 2 will, so the
  extension-registered refusal is the same before and after Phase 2 merges.
  No Phase 4 scenario waits on Phase 2.
- **Do launches re-read agent files?** Yes. pi-subagents discovers agents on
  each `subagent` call through a cache whose fingerprint is every watched
  file's size and mtime (`src/agents/agents.js` `getAgentDiscoverySources`,
  `discoveryFingerprint`, `watchPathSignature`), so a file the load rewrote
  at `session_start` is read on the next call. No session snapshot is kept.
- **Background child detection.** pi-subagents runs background children as
  sessions inside its detached runner process, and the runner sets
  `process.env.PI_SUBAGENT_CHILD = "1"` before any child session starts
  (`src/runs/background/subagent-runner.js:89`: "This process hosts child
  sessions"). pi-subagents itself registers nothing when the variable is `"1"`
  (`index.js`, `registerSubagentExtension`). Ambient extensions, this one
  among them, load into those sessions in `print` mode, and Pi emits
  `session_start` and then `resources_discover` there (`child-session.js`
  `bindExtensions`). Foreground children are sessions inside the parent
  process with `noExtensions: true`, so this extension never runs in one.
  The detection is `PI_SUBAGENT_CHILD === "1"`, the exact signal pi-subagents
  uses.

### Grant form per implementation (MGRT-01, install side)

- `bridges/agents/convert.ts` takes the implementation it renders for. The
  `mcp:` entry of a written server comes from `profileFor(id).grantSelector`
  (plus `/<tool>` for a per-tool grant); a per-tool MCP name that joins
  `excludeTools` on an omitted `tools:` list comes from `profile.toolName`;
  the cannot-narrow warning names the profile's selector. The Claude-form
  match (`mcp__plugin_<p>_<s>` prefix) stays as it is: it is the Claude Code
  name, the same under both implementations.
- **Server set per implementation.** The adapter form maps the servers the
  adapter runs, today's `Object.keys(resolved.mcpServers)` (MSEL-04's
  adapter-supported subset). The built-in form maps the declared servers
  (`resolved.declaredMcpServers`, every non-malformed server) whose built-in
  verdict (`profileFor("builtin").classify`) is supported. A grant of a
  server the implementation cannot run is dropped with today's warning, so
  an `sse` server's grant is kept under the adapter and dropped under
  built-in.
- **Which form the file gets.** The active implementation's form;
  `none` gets the adapter form (ARCHITECTURE "none -> adapter form": the
  form every earlier release wrote). The staging reads the active
  implementation from the run snapshot (`opts.run.softDeps.mcpImplementation`
  in `agentsPhase`, the update staging's run in `update-swap.ts`).
- **Async warning per implementation (D-CF6-10 stays).** Built-in has the
  same foreground gap, so `async: true` stays for an agent that runs plugin
  MCP tools under both. The adapter text stays byte for byte. The built-in
  text ends "a launch before Pi's built-in MCP has listed the server's tools
  still fails", which is what pi-subagents does: it resolves built-in
  selectors against the parent's `getAllTools()` at launch.
- **Agents index (additive, `schemaVersion` stays 1).** A row gains two
  optional fields when the two implementations render the agent differently:
  `mcpImplementation` (the form the file holds now) and the rendered forms,
  one per implementation that rendered: the file's frontmatter block (from
  the opening `---` through the closing `---` line), its warnings, and its
  dropped tools. The body is the same under both, so it is not stored. A row
  whose agent renders the same under both gets neither field, and the load
  never touches it.
- **AG-11 per form.** When the active form maps an explicit `tools:` list to
  nothing, staging fails as it does today. When only the inactive form does,
  that form is not stored, and a later load under that implementation leaves
  the file as it is.

### Load-time rewrite after a switch (MGRT-01, switch side, D-MB-03)

- `orchestrators/mcp/agent-grants-step.ts` fills the frozen seed. It keeps
  the frozen `agentGrantsStep(input)` export and delegates to a testable body
  that takes its environment and file operations as parameters (the
  dependency-injection convention); the production binding passes
  `process.env`.
- It does nothing when the active implementation is `none`, in a background
  child, and for the project scope when `ctx.isProjectTrusted()` is false
  (D-LOC-01). Scopes: user, then project.
- Per scope it first reads the agents index without the lock. Only when a
  row's `mcpImplementation` differs from the active implementation and the
  row holds the active form does it take `withLockedStateTransaction` (no
  `tx.save()`, so `state.json` stays untouched), read the index again, and
  for each such row: when the file's frontmatter equals the recorded form,
  write the active form plus the unchanged body to a temporary file and
  rename it over the target (NFR-1); when it already equals the active form
  (an earlier rewrite whose index save failed), only fix the row; otherwise
  (edited by the user, missing, foreign) leave it and debug-log. The index is
  saved last with the rows' `mcpImplementation`, warnings, and dropped tools
  set to the active form, so a failure before the save self-heals on the
  next load.
- Silent: it reports nothing to the user (a load with nothing to report is
  silent, RECON-05), adds no closed-set entry, and debug-logs every skip and
  failure on the `mcp` channel. A held lock (`StateLockHeldError`) skips the
  scope until the next load. It never throws (NFR-2; the materializer also
  catches).
- **Legacy rows.** A row written before this phase has no stored forms, and
  its file holds the adapter form. The load leaves it. `reinstall`,
  `update`, and disable-then-enable re-stage it with forms.

### Background child (MGRT-02, D-MB-12)

- New leaf `platform/subagent-child.ts`: `isSubagentChild(env)` reads
  `PI_SUBAGENT_CHILD === "1"` from an injected environment (pure; callers
  pass `process.env`). It names pi-subagents' variable as a string literal
  with a cited source line, as the adapter-status field names do.
- The agent grants step is a no-op in a child (above).
- The load reconcile in a child: `orchestrators/reconcile/load.ts` skips the
  autoapply apply step (the read-only pass runs instead, as with autoapply
  off) and passes a no-op AMIG-01 MCP move. `createLoadReconcile` gains an
  optional environment parameter with the `process.env` default, so the
  frozen `index.ts` call stays as it is. The read-only pass still rebuilds
  the hook routing tables, which the child's hooks need.
- Not gated, by design: the MIG-01 first-run config migration and
  `loadState`'s legacy migration (both idempotent, and the parent's load runs
  them before any child exists), the background autoupdate (it arms only in
  `tui`, and a child binds in `print`), and the built-in registrations of
  Phase 2 (a registration lasts for the session and writes nothing; D-MB-12
  allows it).

### Behavioral tests

- `features/mcp-server/agent-grants.feature` drops its feature-level
  `@adapter-only`. Profile-neutral scenarios use a new Phase 4 step that
  starts the profile Pi with pi-subagents plus the profile's MCP launch
  (`mcpImplementationLaunch`), and the frozen listing step `the mcp
  implementation has listed the tools of the stub mcp server ...`. An
  expectation that differs by implementation is an `@adapter-only` and
  `@builtin-only` pair naming MGRT-01 or D-CF6-10.
- **Install side (both profiles).** Installing (and updating, reinstalling,
  enabling) a plugin whose agent is granted `mcp__plugin_demo_stub__echo`
  shows the active implementation's selector in `subagent get`, and the
  foreground refusal names the profile's selector or server.
- **Switch side (`@own-implementation`).** Install under the adapter; restart
  so built-in is active; `subagent get` shows the built-in selector while an
  agent with no MCP grant is unchanged; a restart with no MCP keeps the files
  as they are.
- **Background child.** A profile Pi started with `PI_SUBAGENT_CHILD=1`
  through the launch-environment stand-in (`features/lib/pi-launch-environment.ts`)
  plays the background child: it leaves an adapter-form agent alone under
  built-in, and with `autoapply` on it installs nothing; a later Pi with
  pi-subagents and no MCP reports the unchanged selector, and `list` reports
  the plugin still missing.
- `features/lib/upstream/subagents.ts`'s error projection learns the
  built-in names (`plugin_<p>_<s>` and `plugin_<p>_<s>/<tool>`), keeping the
  adapter projection unchanged.
- Red proof per profile: each new scenario fails on the pre-phase tree under
  every profile it runs in, recorded in the plan SUMMARY.

### Ownership and parent lines

- Phase 4 edits only its own files plus two that no phase owns:
  `orchestrators/reconcile/load.ts` (the MGRT-02 gate) and
  `features/lib/upstream/subagents.ts` (the projection). Both are logged.
- Cross-phase note (parent line): Phase 3's `@builtin-only` scenario
  "Update preserves dependency move warnings and MCP notices, under Pi's
  built-in MCP" in `features/mcp-server/verdict-markers.feature` expects the
  adapter's async warning text; after the Phase 4 merge, its row reads the
  built-in text. Phase 3 re-runs its rows after merging the milestone branch.
- Parent lines for `docs/mcp-compatibility.md` (Phase 2's file): the agents
  section's `mcp:` entry and override examples gain the built-in form.
  CHANGELOG and README lines go to the last plan's SUMMARY.

### Claude's Discretion

- Exact names of the new index fields, the new convert input, and the step's
  internal helpers.
- Whether the rewrite helper lives in `bridges/agents/` (preferred: it owns
  the file format) with the step orchestrating the lock.
- How the update, reinstall, and enable legs are grouped in the feature file
  (a Scenario Outline is fine), within the CI time budget.

### Deferred Ideas (OUT OF SCOPE)

- Rewriting legacy rows (written before this phase, no stored forms) at load
  without a reinstall: needs a lossy reverse mapping for long built-in tool
  names; left for a follow-up if the user wants it.
- A user-visible warning when a load cannot rewrite an agent (edited file,
  held lock): would need a new closed-set entry.
- Background agents calling plugin MCP tools under built-in (MCPV2-03).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MGRT-01 | A generated pi-subagents agent's MCP grants name the active implementation's server, and after a switch and `/reload` the load rewrites only the agent files whose grants changed, atomically, with no user action (D-MB-03); with no active implementation the files stay as they are | Convert/stage seams (Pattern 1, 2), index fields (Pattern 3), the rewrite (Pattern 4), the call sites (Pattern 5), the cascade gap (Open Question 1), the measured red proofs (Validation Architecture) |
| MGRT-02 | A background subagent child that loads the extension never rewrites agent files or any other installation state | `PI_SUBAGENT_CHILD` (verified at `subagent-runner.js:89`), the lazy-read pitfall (Pitfall 3), the `load.ts` gate (Pattern 6), the launch-environment probe (Validation Architecture) |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Read a file before you edit it, and trace a function's callers before you change it.
- Never commit to `main`. Commit titles follow `.agents/skills/committing/SKILL.md`, with no phase, plan, or milestone identifiers. Never use `--no-verify`. Never rebase or amend.
- A user-visible `/claude:plugin` behavior change ships a cucumber scenario that fails without the change (`cucumber` skill).
- NFR-1: every disk mutation is atomic (tmp then rename, or the atomic JSON write).
- NFR-2: no throw escapes `session_start` or `resources_discover`. `/claude:plugin apply` then `/reload` must be enough to recover.
- NFR-3: every operation can be retried safely.
- NFR-10 containment: write only under `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, `<scopeRoot>/mcp-adapter.json`, and `<scopeRoot>/mcp.json`.
- IL-2: all output goes through `shared/notification-dispatch.ts`. The step prints nothing, and `hookDebugLog` is the trace channel.
- NFR-5: `orchestrators/` and `domain/` must not import `platform/git` (ESLint BLOCK F). The new files name no git surface.
- Quality bar: `npm run check` (typecheck, ESLint `--max-warnings 0`, fallow with dead code, health, dupes, rule pack, and boundaries, Prettier, pairing, unit and integration tests, and 100% direct coverage for each source-test pair).
- Complexity: ESLint `sonarjs/cognitive-complexity: 15`, plus fallow `maxCognitive: 15` and `maxCyclomatic: 20`. Both apply independently. Exported functions need explicit return types. Named exports only. The `import-x/order` groups are builtin, external, internal, parent, sibling, then type imports last.
- Every plan SUMMARY.md has `## Threat Flags`. `gsd-tools windows append --description` takes the `[mcp-builtin]` prefix.
- Child-session rules: never edit a frozen file (`01-FROZEN.md` section 1); a needed change is a Parent line. Edit only Phase 4-owned files plus `orchestrators/reconcile/load.ts` and `features/lib/upstream/subagents.ts`, and create `platform/subagent-child.ts`. Run npm scripts with `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. A RED-only commit is refused, so commit the test and its implementation together and record the RED run in the SUMMARY.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Grant selector, per-tool exclude name, and async warning per implementation | `bridges/agents/convert.ts` | `domain/mcp-implementation.ts` (frozen profiles) | The bridge owns the file format. The domain owns naming (`grantSelector`, `toolName`, `classify`). |
| The two rendered forms and the index row fields | `bridges/agents/stage.ts` + `persistence/agents-index-schema.ts` | `bridges/agents/frontmatter.ts` | Staging builds the rows. The schema validates them. The emitter splits frontmatter from body. |
| Built-in server set (declared and built-in-supported) | `bridges/agents/` (computed from `declaredMcpServers`) | — | Computing it once in the bridge keeps the two call sites from cloning it. `bridges-agents -> domain` is allowed (`.fallowrc.json` rules). |
| Choosing the active form at staging | `orchestrators/plugin/install-outcome.ts` `agentsPhase` and the `update-swap.ts` agent staging | `shared/notification-run.ts` (`run.softDeps`) | The run snapshot is the only source of the active implementation (D-05). |
| Load-time rewrite: when, which scopes, the lock | `orchestrators/mcp/agent-grants-step.ts` | `transaction/with-state-guard.ts` | The orchestrator decides policy (`none`, child, trust, lock). |
| Load-time rewrite: matching the file bytes, tmp and rename, saving the index | NEW `bridges/agents/<rewrite module>.ts` | `persistence/agents-index-io.ts`, `shared/path-safety.ts` | The file format belongs to the bridge, and fallow allows `orchestrators -> bridges-agents`. |
| Child detection | NEW `platform/subagent-child.ts` | — | A pure environment read. `platform` may import only `shared`. |
| Child gate on the load reconcile | `orchestrators/reconcile/load.ts` | `orchestrators/reconcile/types.ts` (`McpMigrationStep`) | `index.ts` is frozen, so the gate goes behind an optional factory parameter. |

## Standard Stack

No new packages. Everything is already in the tree.

### Core (already present)
| Library / module | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typebox` (`Type`, `Compile`) | 1.4.3 installed (`node_modules/typebox/package.json`) [VERIFIED: probe this session] | Agents-index row schema | Already compiles `AGENTS_INDEX_ENTRY_VALIDATOR`. `Type.Object` accepts additional properties by default (probe: `V.Check({ a: "x", zz: 1 })` printed `true`). |
| `transaction/with-state-guard.ts` `withLockedStateTransaction` | in tree | Per-scope lock with no forced save | The read pass uses it the same way (`read-pass.ts:288-300`, "WR-05: `tx.save()` is deliberately NEVER called"). |
| `persistence/agents-index-io.ts` `loadAgentsIndex` / `saveAgentsIndex` | in tree | Row I/O with per-row soft-fail and an atomic save | `saveAgentsIndex` validates and then calls `atomicWriteJson` (`agents-index-io.ts:154-160`). |
| `node:fs/promises` `writeFile`, `rename`, `mkdir`, `readFile` | Node 24.22.1 | tmp and rename rewrite | The stage commit uses the same primitives (`stage.ts:27`). `write-file-atomic` is chokepointed and must not be used here. |
| `strong-mock`, `node:test`, `node:assert/strict` | dev deps | Unit tests | The only allowed test tools (`typescript-unit-tests` skill). |

**Installation:** none.

## Package Legitimacy Audit

No external package is installed in this phase.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
install / enable / import / install cascades           update / reinstall (direct)      autoupdate / apply converge / dep move (cascade)
          |                                                     |                                     |
  runInstallLedger(opts.run)                         ThreePhaseArgs.run (Direct)          CascadeThreePhaseArgs (run?: never)
          |                                                     |                                     |
  agentsPhase  ── active = run.softDeps.mcpImplementation ──  agent staging fn ── active = run ?? preflightNotification?.run ?? "none"
          \                                                     |                                     /
           └──────────────► prepareStagePluginAgents({ ..., mcpServerNames(adapter), declaredMcpServers, mcpImplementation })
                                           |
                       convert per form: adapter (resolved.mcpServers keys) and builtin (declared ∩ builtin-supported)
                                           |
                     file = active form (none → adapter)   row.mcpImplementation + row.mcpForms (only when the forms differ)
                                           |
                          commitPreparedAgents → rename → saveAgentsIndex (last)

Pi session_start ─► createMcpSessionMaterializer (frozen) ─► builtinRegistrationStep (Phase 2) ─► agentGrantsStep
                                                                                                        |
                         active none? child (PI_SUBAGENT_CHILD=1)? → return      for scope in [user, project if trusted]:
                                                                                                        |
                                    unlocked loadAgentsIndex → any row with mcpImplementation ≠ active && mcpForms[active]?
                                                                                                        | yes
                    withLockedStateTransaction(loc, body, { persistMigration: false })  (StateLockHeldError → skip, debug-log)
                                                                                                        |
         per row: file startsWith recorded form → write active form + rest via agents-staging/<uuid> + rename
                  file startsWith active form   → fix row only
                  otherwise (edited / missing / foreign) → leave, debug-log
                                                                                                        |
                                        saveAgentsIndex (last) with the rows set to the active form

Pi resources_discover ─► loadReconcile (load.ts): child? → skip autoapply, no-op AMIG-01 move, read-only pass still rebuilds hook routing
```

### Recommended file layout (Phase 4 files)

```text
extensions/pi-claude-marketplace/
├── bridges/agents/convert.ts        # MOD: grants per McpImplementationId; per-profile async warning; returns the frontmatter block
├── bridges/agents/frontmatter.ts    # MOD: emit frontmatter and body as two parts (file = frontmatter + body)
├── bridges/agents/types.ts          # MOD: StageAgentsInput gains declaredMcpServers + mcpImplementation; ConvertedAgent gains frontmatter
├── bridges/agents/stage.ts          # MOD: render the forms, build the optional row fields
├── bridges/agents/<grant-forms>.ts  # NEW (name at discretion): needsGrantRewrite + rewriteAgentGrants (file bytes, tmp+rename, index save)
├── persistence/agents-index-schema.ts # MOD: optional mcpImplementation + mcpForms
├── orchestrators/mcp/agent-grants-step.ts # FILL the frozen seed
├── orchestrators/reconcile/load.ts  # MOD (unowned, logged): optional env parameter, child gate
├── orchestrators/plugin/install-outcome.ts # agentsPhase only
├── orchestrators/plugin/update-swap.ts     # the agent staging only (extract it into its own function, see Pattern 5)
└── platform/subagent-child.ts       # NEW: isSubagentChild(env)
test/<same paths>.test.ts            # one pair per source (scripts/check-corresponding-tests.mjs)
test/integration/agents-*.test.ts    # NEW (optional): conformance against pi-subagents' own resolver
features/mcp-server/agent-grants.feature, features/step_definitions/mcp-server/agent-grants.steps.ts, features/lib/upstream/subagents.ts (unowned, logged)
```

### Pattern 1: Grants keyed by implementation in `convert.ts`

**Where the adapter form is hard-coded today** [VERIFIED: read `bridges/agents/convert.ts` this session]:

- `:14`: `import { declaredAgentName, generatedMcpServerKey } from "../../domain/name.ts";`
- `:90-93`: `interface McpGrant { readonly key: string; readonly claudePrefix: string; }`
- `:120-123`: `MCP_ASYNC_WARNING` = `"tools include MCP tools, which pi-subagents serves only to background children -- " + "the agent runs in the background (\`async: true\`), where Claude Code runs it in the " + "foreground; a launch before pi-mcp-adapter has cached the server's tools still fails"`
- `:335-345`: `buildMcpGrants(pluginName, serverNames)` builds `key = generatedMcpServerKey(pluginName, server)` and `claudePrefix: \`mcp__${key.slice(0, -1)}\``, sorted longest prefix first.
- `:364`: `matchMcpGrant` returns `const server = \`mcp:${grant.key}\`;` (the selector).
- `:373-375`: `mcpEntry(match)` gives `match.server` or `` `${match.server}/${match.tool}` ``.
- `:505-515`: `explicitMcpWarnings` interpolates `${server}` (the selector), so the cannot-narrow warning follows the selector with no extra change.
- `:521-523`: `perToolMcpName(token, grants)` returns the Claude token **verbatim** (`return matchMcpGrant(token, grants)?.tool === undefined ? undefined : token;`). `omittedToolMapping` uses it at `:550`.
- `:799-833`: `ConvertAgentInput.mcpServerNames?: readonly string[] | undefined` (`:827`).
- `:892-902`: `buildMcpGrants(pluginName, mcpServerNames)`, then `runsMcpTools(toolsResult, mcpServerNames)`, then `warnings.push(MCP_ASYNC_WARNING)`.
- `:1011-1020`: `runsMcpTools`: an omitted list counts as `(mcpServerNames ?? []).length > 0`; an explicit list counts as `mapped.some((name) => name.startsWith("mcp:"))`.

**Change:**

1. `McpGrant` becomes `{ readonly selector: string; readonly claudePrefix: string; readonly exclude: (tool: string) => string }`, or it keeps `plugin` and `server` and calls the profile lazily. Build it from `profileFor(id)`. `selector = profile.grantSelector(plugin, server)`, and `claudePrefix` stays `` `mcp__${generatedMcpServerKey(plugin, server).slice(0, -1)}` ``. Claude's name is the same under both implementations, and `claudeMcpServerName` is private to the frozen `name.ts`.
2. `matchMcpGrant` returns `server: grant.selector`.
3. `perToolMcpName` returns `profile.toolName(plugin, server, match.tool)`. For the adapter this is byte-identical to the verbatim token for every Claude-form name: `adapterToolName` only folds `.` (`mcp-implementation.ts:63-71`), and Claude Code already replaces `.` in tool names (`docs/mcp-compatibility.md:275`). So existing adapter bytes do not change. [VERIFIED: read]
4. `MCP_ASYNC_WARNING` becomes a per-id table. The adapter keeps its exact text. The built-in text is `"tools include MCP tools, which pi-subagents serves only to background children -- the agent runs in the background (\`async: true\`), where Claude Code runs it in the foreground; a launch before Pi's built-in MCP has listed the server's tools still fails"` (wording locked by CONTEXT).
5. `ConvertAgentInput` gains the form to render: e.g. `mcp?: { readonly implementation: McpImplementationId; readonly serverNames: readonly string[] }`, with absent meaning the adapter and no servers. `runsMcpTools` reads that form's `serverNames`.
6. Return the frontmatter block beside `fileContent` (see Pattern 2), so stage can store it without searching the text.

**AG-11 per form (P4-DC-12):** `assertMappedToolsNonEmpty` (`:1039-1057`) throws a plain `Error`. Do not `try/catch` the inactive conversion, because a broad catch would also hide unrelated errors. Split the conversion into a part that returns the validated mapping, or `undefined` for an empty explicit list, and a part that asserts. Apply the assert to the active form only. Keep `convertAgent`'s exported contract (throw on an empty active list) so the existing AG-11 tests stay valid.

### Pattern 2: Frontmatter block and body as separate strings

`emitGeneratedAgentFile` (`frontmatter.ts:497-591`) builds `const generatedFrontmatter = "---\n" + lines.join("\n") + "\n---\n";` (`:580`) and returns `generatedFrontmatter + bodyFinal`. `bodyFinal` always starts with `"\n"` and ends with `"\n"` (`:585-590`). [VERIFIED: read]

- Export a parts function (for example `emitGeneratedAgentParts(input): { frontmatter: string; body: string }`). Keep `emitGeneratedAgentFile` as the join, so `frontmatter.test.ts` and the integration test `provenance-invisibility.test.ts` keep working.
- The stored form is exactly `generatedFrontmatter`, from the opening `---\n` through the closing `---\n`. The file's provenance warnings (async warning, cannot-narrow) and its `droppedTools` sit inside that block. So the body is the same under both forms, which is the CONTEXT premise.
- The load matches with `text.startsWith(recordedFrontmatter)` and writes `activeFrontmatter + text.slice(recordedFrontmatter.length)`. Never search the text for `---`: a body can contain `\n---\n`.

### Pattern 3: Agents-index row fields (additive, schemaVersion 1)

Today [VERIFIED: `persistence/agents-index-schema.ts:26-38`]:

```ts
const AGENTS_INDEX_ENTRY_SCHEMA = Type.Object({
  plugin: Type.String(),
  marketplace: Type.String(),
  sourceAgent: Type.String(),
  generatedName: Type.String(),
  sourcePath: Type.String(),
  targetPath: Type.String(),
  sourceHash: Type.String(),
  originalModel: Type.Optional(Type.String()),
  droppedFields: Type.Array(Type.String()),
  droppedTools: Type.Array(Type.String()),
  warnings: Type.Array(Type.String()),
});
```

The document schema is `Type.Object({ schemaVersion: Type.Literal(1), agents: Type.Array(AGENTS_INDEX_ENTRY_SCHEMA) })` (`:48-51`).

Recommended addition (names at discretion):

```ts
const AGENT_MCP_FORM_SCHEMA = Type.Object({
  frontmatter: Type.String(),
  warnings: Type.Array(Type.String()),
  droppedTools: Type.Array(Type.String()),
});
// in AGENTS_INDEX_ENTRY_SCHEMA:
mcpImplementation: Type.Optional(Type.Union([Type.Literal("adapter"), Type.Literal("builtin")])),
mcpForms: Type.Optional(Type.Object({
  adapter: Type.Optional(AGENT_MCP_FORM_SCHEMA),
  builtin: Type.Optional(AGENT_MCP_FORM_SCHEMA),
})),
```

Add a type-level drift check against `McpImplementationId` (the `resolver-types.ts` `AssertTrue` idiom), or import the type from `platform/pi-api.ts`. `persistence -> platform` is allowed.

**Survival of the new fields** [VERIFIED: read]:

- `loadAgentsIndex` pushes the **raw parsed row** when `AGENTS_INDEX_ENTRY_VALIDATOR.Check(row)` passes (`agents-index-io.ts:128-137`). Unknown fields are kept, and TypeBox 1.4.3 allows extra properties (probe this session).
- `saveAgentsIndex` validates the whole document, then writes it atomically (`:154-160`).
- `stage.ts` keeps `otherEntries` and `foreignPreservedEntries` verbatim (`:143-147`, `:191-204`, `:474-477`). `unstage.ts` keeps `nonMatching` and `preservedEntries` verbatim (`:112-115`). `prune-rollback.ts:348-353` reads only `plugin`, `marketplace`, and `targetPath`, and snapshots the index **bytes** (`:378-384`). `target-check.ts:35` reads rows. No code rebuilds another plugin's row, and no code outside `bridges/agents/` reads `warnings`, `droppedTools`, or `originalModel` (grep this session). An older release that loads a new row keeps it (extra properties pass), and it rewrites only the rows of a plugin it re-stages.
- **Caveat (AG-4):** a row whose new fields fail the schema is dropped whole and becomes a corruption warning, so its file loses its owner row. That is the existing rule for any malformed row. Staging must always write well-formed forms.

### Pattern 4: The load-time rewrite (bridge helper plus step)

The step's input is frozen (`agent-grants-step.ts:15-21`): `{ readonly pi: PiInventory; readonly ctx: ExtensionContext; readonly snapshot: NotificationRun }`. The active implementation is `input.snapshot.softDeps.mcpImplementation`. The cwd is `input.ctx.cwd` (Pi's `ExtensionContext` has `cwd: string` and `isProjectTrusted(): boolean`, `pi-coding-agent/dist/core/extensions/types.d.ts:240,257`). The locations are `locationsFor(scope, cwd)` (`persistence/locations.ts:219`). It gives `agentsDir`, `agentsStagingDir`, `extensionRoot`, and `agentsIndexPath`.

Recommended split:

- **Bridge module** (new, `bridges/agents/`), exported and consumed by the step:
  - `rowsNeedingRewrite(rows, active)` (pure): `row.mcpImplementation !== undefined && row.mcpImplementation !== active && row.mcpForms?.[active] !== undefined && row.mcpForms[row.mcpImplementation] !== undefined`.
  - `rewriteAgentGrantForms(locations, active, ops)`: re-reads the index and handles each row. First `assertPathInside(locations.agentsDir, row.targetPath, ...)` (NFR-10), and check that the basename is `${row.generatedName}.md`. Then read the file. ENOENT means leave the row and log. A file that starts with the recorded form is written through `<agentsStagingDir>/<uuid>/<name>.md` and then renamed over the target. That is the stage commit's own path (`stage.ts:207-226, 464-468`), on the same filesystem, and inside NFR-10. A file that starts with the active form gets only its row fixed. Any other file is left and logged. Then save the index last, with `mcpImplementation`, `warnings`, and `droppedTools` set from the active form. Clean up the staging directory with `cleanupStaging(ops, dir, label)` (`shared/fs-utils.ts:85`).
  - Defense in depth: before writing a stored form, check that it starts with `---\n`, ends with `\n---\n`, and contains `GENERATED_AGENT_MARKER` (`marker.ts:32`, `"generatedBy: pi-claude-marketplace"`). A form that fails the check is skipped.
- **Step** (`orchestrators/mcp/agent-grants-step.ts`). It returns when `active === "none"` or `isSubagentChild(env)`. The scopes are `["user", ...(ctx.isProjectTrusted() ? ["project"] : [])]`. For each scope, inside a `try`: do the unlocked `loadAgentsIndex(loc)` (the ENOENT path returns empty and creates nothing), filter with `rowsNeedingRewrite`, and only then call `withLockedStateTransaction(loc, () => rewriteAgentGrantForms(...), { persistMigration: false })`. Catch everything: a `StateLockHeldError` (`shared/errors.ts:954`) skips the scope, and any other error is debug-logged with `hookDebugLog(msg, "mcp")` (`shared/debug-log.ts:22`, `hookDebugLog(detail: string, tag = "hooks")`). Never throw.

Why `{ persistMigration: false }`: `withLockedStateTransaction` loads state with `persistMigration: deps?.persistMigration ?? true` (`with-state-guard.ts:96-98`). `loadState` then saves a migrated legacy `state.json` in the background (`state-io.ts:597-599`). The step needs the lock, not the state, so turn that write off.

The lock creates the extension root (`withScopeLock` calls `mkdir(locations.extensionRoot, { recursive: true })`, `with-state-guard.ts:121-127`). Only call it after the unlocked read found rows: a pristine scope has no index, so it never reaches that path, and a test can assert that the extension root is still absent.

**Fallow and testability (decide before coding):** fallow's production dead-code run reports an export that no other production module imports ("The export may still be used locally within the same file", `npx fallow explain unused-export`), and test imports do not count. So a separately exported "testable body" inside `agent-grants-step.ts` would fail `npm run fallow`. Two options that pass:

- (a) The exported function takes an optional environment, the same precedent as `createPluginUpdateOperations(..., env: ClaudeEnv = process.env, ...)` (`update-flow.ts:1501-1506`): `export function agentGrantsStep(input: AgentGrantsStepInput, env: SubagentChildEnv = process.env): Promise<void>`. The frozen materializer calls it with one argument (`session-materialize.ts:76`), so the type stays assignable. **Recommended.**
- (b) Keep the frozen one-parameter signature, and have the tests set and restore `process.env.PI_SUBAGENT_CHILD` with `t.after()` (`typescript-unit-tests` boundaries rule allows it).

The file operations need no injection: the conventions prefer real temp directories (`createHermeticEnvironment`, `test/platform/hermetic-environment.ts:59`), and a held lock can be produced for real by running the step inside `withLockedStateTransaction` on the same scope (`retries: 0`, not re-entrant, so the step gets `StateLockHeldError`).

### Pattern 5: The two staging call sites, and every caller

`prepareStagePluginAgents` has exactly two production callers (grep this session):

| Call site | Lines | Run snapshot | Paths through it |
|---|---|---|---|
| `install-outcome.ts` `agentsPhase` | `:1304-1356` (call at `:1307-1327`, `mcpServerNames: Object.keys(installCtx.resolved.mcpServers)` at `:1324`) | `opts.run` is required on `InstallLedgerOptions` (`:219-222`), and `opts` is in scope (`runInstallLedgerBody(..., opts, ...)`, `:1115-1120`) | install, enable (`enable-disable.ts:429, 1011` through `transaction.runInstallLedger`), import, install cascades (`install-cascade.ts:1306, 1455`), dependency installs (`install-flow-results.ts:501`) |
| `update-swap.ts` `prepareUpdateHandles` | `:368-455` (agents at `:406-424`, `mcpServerNames: Object.keys(installable.mcpServers)` at `:421`) | `args.run` exists only on `DirectThreePhaseArgs` (`:281-287`). `CascadeThreePhaseArgs` has `readonly run?: never` (`:290-294`). `args.preflightNotification?: { ctx; run }` exists on the base (`:258`) | update (direct, `update-flow.ts:291-307`), reinstall (`reinstall-flow.ts:407-418`, `cascade: false`, with `...opts`, which carries `run`), autoupdate cascade (`update-flow.ts:776-819`, no run, no preflightNotification), apply converge (`update-flow.ts:825-841`, no run), dependency move (`dependency-move.ts:152-180`, `preflightNotification` only when `context.notification` is set) |

`installable` exposes both `mcpServers` and `declaredMcpServers` (`resolver-types.ts:154-159`, `MaterializableFields`). `resolved.mcpServers` is the adapter-supported subset, and `declaredMcpServers` is every non-malformed server (`mcp-resolution.ts:346-362`).

**Recommendation for update-swap:** move the `handles.agents = await prepareStagePluginAgents(...)` block into its own function, for example `prepareUpdateAgents(ops, args, preflight, agentsDirs, referenceNames, skills)`. That gives Phase 4 an "agent staging function" to own, and it keeps `prepareUpdateHandles` under the complexity limits (its neighbor's comment at `:477-478` says it "already sit[s] near the fallow `maxCognitive: 15` ceiling"). Read the implementation through one small function: `args.cascade ? args.preflightNotification?.run.softDeps.mcpImplementation ?? "none" : args.run.softDeps.mcpImplementation`. Phase 3 plans to put an implementation field on `ThreePhaseArgs` (Phase 3 RESEARCH, "thread `mcpImplementation` into `ThreePhaseArgs` from `materialize-latest.ts`"), so this one function is the only line to repoint at merge.

**Bridge input:** add `declaredMcpServers?: Readonly<Record<string, unknown>>` and `mcpImplementation?: ActiveMcpImplementation` to `StageAgentsInput` (`types.ts:73-114`), and keep `mcpServerNames` as the adapter set. The bridge computes the built-in set with `Object.entries(declared).filter(([, c]) => profileFor("builtin").classify(c).kind === "supported").map(([name]) => name)` (`McpServerVerdict` = `{ readonly kind: "supported" } | { readonly kind: "blocked"; readonly feature: McpUnsupportedFeature } | { readonly kind: "malformed"; readonly detail: string }`, `mcp-server-features.ts:51-54`). Both call sites then add only two property lines, so fallow `dupes` finds no new clone.

**Stage:** discovery and skill preloads stay single (`stage.ts:98-120`). Convert each agent for the active form (`none` means adapter). When the plugin declares at least one server, also convert for the other id. Compare the frontmatter blocks. Store `mcpImplementation` and `mcpForms` only when they differ, and leave out the inactive form when AG-11 would empty it. The AS-9 no-op (`:172-182`), the AG-5 soft-fail (`:191-204`), and the commit order (index saved last, `:474-477`) stay as they are. User-visible warnings come from the active form's `warnings` (`formatAgentWarnings`, `:284-302`).

### Pattern 6: The child gate in `load.ts`

Today [VERIFIED: read `orchestrators/reconcile/load.ts`]: `createLoadReconcile(reader, applyReconcile)` (`:204-211`) returns `loadReconcile(opts)`, which calls `loadReconcileWithReader` (`:150-195`). That function first calls `autoapplyScopes(applyReconcile, opts)` (`:103-120`), which reads the four config files and runs the apply step when autoapply is on. It then runs `openScopePass({..., migrateMcpEntries: opts.migrateMcpEntries, ...})` per scope (`:170-177`). The read pass falls back to `migrateLegacyMcpEntries` when the step is absent (`read-pass.ts:434-438`). `McpMigrationStep = (input: McpMigrationInput) => Promise<void>` (`reconcile/types.ts:426`). `index.ts:120` (frozen) calls `createLoadReconcile({ loadState }, applyReconcile)`.

Recommended shape:

```ts
const SKIP_MCP_MOVE: McpMigrationStep = () => Promise.resolve();

export function createLoadReconcile(
  reader: ReconcileStateReader,
  applyReconcile: (opts: ApplyReconcileOptions) => Promise<void>,
  env: SubagentChildEnv = process.env,
): (opts: LoadReconcileOptions) => Promise<void> {
  return async function loadReconcile(opts: LoadReconcileOptions): Promise<void> {
    // MGRT-02: read at event time; the environment can change after the factory ran.
    if (isSubagentChild(env)) {
      await readOnlyLoad(reader, { ...opts, migrateMcpEntries: SKIP_MCP_MOVE });
      return;
    }
    await loadReconcileWithReader(reader, applyReconcile, opts);
  };
}
```

`readOnlyLoad` is the existing body with `scopes = SCOPES`. Extract the body after `autoapplyScopes` into one helper both branches call, so neither function crosses cognitive 15, and no clone appears. ESLint and fallow do not forbid `process.env` in orchestrators: the rule pack bans only `process.stdout.*` and `process.stderr.*` (`rule-packs/architecture.json:9`), and `env = process.env` defaults already exist (`mcp-migration.ts:840`, `update-flow.ts:1505`, `install-flow.ts:59`). [VERIFIED: grep and read]

### Anti-Patterns to Avoid

- **Reading `PI_SUBAGENT_CHILD` at factory time:** the harness's launch-environment extension sets the variable when Pi loads **it**, which comes after this extension (`_rpc.ts:261`, `extensions = [EXTENSION_ENTRY, ...extraExtensions]`, loaded one after another, `loader.js:562-563`). Keep the `process.env` object reference (not a copy such as `{ ...process.env }`), and call `isSubagentChild(env)` inside the event handler.
- **A second `try/catch` around the inactive conversion:** it hides real conversion failures. Make AG-11 a returned verdict for the inactive form.
- **Searching for the closing `---`** in an agent file: use `startsWith` with the stored block.
- **Writing a temporary `.md` next to the target in `agents/`:** pi-subagents watches that folder by size and mtime. Use `<extensionRoot>/agents-staging/<uuid>/`, as staging does.
- **Taking the state lock on every `session_start`:** do the unlocked index read first. The shared cucumber Pi starts a session before every scenario.
- **Importing `bridges/agents` from `index.ts` or `edge`:** the entry zone may not import `bridges-agents` (`.fallowrc.json` rules).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Built-in tool name, including Pi's 64-character hash cut | a new sanitizer | `profileFor("builtin").toolName(plugin, server, tool)` (`mcp-implementation.ts:109-123`) | It matches Pi 1.5.0 `createMcpToolName`, and it is frozen |
| Built-in selector | string concatenation | `profileFor(id).grantSelector(plugin, server)` (`:79`, `:131`) | Frozen, and P1-DC-28 confirmed it this phase |
| Built-in support verdict | your own `sse` check | `profileFor("builtin").classify(config)` | One Claude-shape check shared with the adapter |
| Per-scope cross-process lock | your own lockfile | `withLockedStateTransaction` (no `tx.save()`) | `proper-lockfile` is chokepointed to `with-state-guard.ts` (rule pack) |
| Atomic index write | `writeFile` | `saveAgentsIndex` → `atomicWriteJson` | NFR-1, and `write-file-atomic` is chokepointed |
| Path containment | `startsWith` on paths | `assertPathInside` (`shared/path-safety.ts:18`) | It handles symlinks and realpath |
| Ownership marker | your own substring | `GENERATED_AGENT_MARKER` / `isOwnedAgentFile` (`marker.ts:32, 55-86`) | AG-5 user contract |

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `<scopeRoot>/pi-claude-marketplace/agents-index.json` rows written before this phase have no `mcpImplementation` and no `mcpForms`, and their files hold the adapter form | None in code: the load leaves them alone (CONTEXT "Legacy rows", P4-DC-06). `reinstall`, `update`, or disable then enable re-stages them with forms |
| Live service config | None. pi-subagents keeps no stored config about our agents; it re-reads the files every call (CONTEXT) | none |
| OS-registered state | None | none |
| Secrets/env vars | `PI_SUBAGENT_CHILD` is read, never written. It is pi-subagents' variable (`src/runs/shared/child-runtime-config.js:6`, `export const SUBAGENT_CHILD_ENV = "PI_SUBAGENT_CHILD";`) | none |
| Build artifacts | None | none |

## Common Pitfalls

### Pitfall 1: The cascade update paths have no run snapshot
**What goes wrong:** the marketplace autoupdate cascade and `apply`'s convergence pass `CascadeThreePhaseArgs` with no `run` and no `preflightNotification`. Under built-in, they re-stage agents in the adapter form, and the cascade's staging warning shows the adapter text.
**Why:** `update-flow.ts:776-819` and `:825-841` build cascade args from `bindings` alone.
**How to avoid:** use the fallback chain in Pattern 5 and rely on the next load's rewrite (the row stores both forms). Record it as a dubious choice, and add a parent or cross-phase line to point the function at Phase 3's `ThreePhaseArgs` field if it lands.
**Warning signs:** a `@builtin-only` autoupdate or apply scenario that expects the built-in selector before a `/reload`.

### Pitfall 2: An export used only by tests fails `npm run fallow`
See Pattern 4 under "Fallow and testability". It applies to every new helper: each export needs a production importer.

### Pitfall 3: The child variable arrives after the factory
In the harness (and in some real orderings), `PI_SUBAGENT_CHILD` is set after this extension's factory ran. Read it in `session_start` and in `resources_discover`. This session's scratch probe confirmed that a profile Pi with `companions: ["pi-subagents"]` and `PI_LAUNCH_ENVIRONMENT_EXTENSION` applies `[{"PI_SUBAGENT_CHILD":"1"}]` and still offers the `subagent` tool. pi-subagents registered before the variable existed (`index.js:224-227` returns early only at its own factory time).

### Pitfall 4: The projection's alternation order
In `features/lib/upstream/subagents.ts`, the built-in pattern must come **after** the adapter pattern. Otherwise `plugin_demo_stub_/echo` projects as `plugin_demo_stub`. Verified in Node this session:

```ts
const OWNED_ERROR_VALUE_PATTERN =
  /\b(?:[a-z0-9-]+\/claude-[A-Za-z0-9.[\]-]*[A-Za-z0-9\]]|plugin_[A-Za-z0-9_-]*_\/[A-Za-z0-9_-]+|plugin_[A-Za-z0-9_-]*[A-Za-z0-9-](?:\/[A-Za-z0-9_-]+)?)/gu;
```

Results: `"...does not offer: mcp:plugin_demo_stub_/echo..."` gives `plugin_demo_stub_/echo` (unchanged). `"...extensions registered (plugin_demo_stub)..."` gives `plugin_demo_stub`. `"mcp:plugin_demo_stub/echo"` gives `plugin_demo_stub/echo`. The adapter's `"Unresolved MCP direct-tool selectors: plugin_demo_stub_/echo"` is unchanged, and so is `anthropic/claude-sonnet-5-5`. Only three feature rows use `subagent failed` today (`error naming anthropic/claude-sonnet-5-5`, `error naming plugin_demo_stub_/echo`, `error`), and none changes.

### Pitfall 5: "An agent with no MCP grant is unchanged" needs an explicit `tools:` list
An agent with **no** `tools:` line in a plugin that declares MCP servers renders differently per form: `async` stays `true` under both, but the async-warning text in the provenance differs. So the load rewrites it. The "unchanged" control agent must have an explicit list with no MCP name, such as `tools: Read`, which shows as `tools read`.

### Pitfall 6: A profile Pi with only pi-subagents runs built-in, even under the adapter profile
`expectedMcpImplementation` returns `builtin` when the adapter is not loaded and neither `--no-mcp` nor `-builtin:mcp` is set (`features/lib/mcp-implementation.ts:154-160`). The adapter profile seeds `mcp-onboarding.json`, so the shared adapter Pi never writes `-builtin:mcp`. So after Phase 4, an install **inside** such a Pi writes the built-in form under both profiles, as in `features/agent/lifecycle.feature`'s Background. Only an `@own-implementation` profile Pi that loads the adapter makes the adapter's real first-run write (`world.ts:871-875`).

### Pitfall 7: Red proofs for "nothing happens"
A scenario whose expectation is "the file stays as it is" (the child grants leg, and "no MCP keeps the files") passes on the pre-phase tree, because nothing rewrote before. Design each scenario so its expected selector differs from what the pre-phase tree produces (see Validation Architecture). Otherwise, record a mutation red (the gate removed) in the SUMMARY. The rule to follow is "fails on the pre-phase tree".

### Pitfall 8: Phase 3's row quotes the adapter async warning under built-in
`features/mcp-server/verdict-markers.feature` (the `@builtin-only` "Update preserves dependency move warnings ... under Pi's built-in MCP") expects `... a launch before pi-mcp-adapter has cached the server's tools still fails`. After Phase 4, that dependency move carries `preflightNotification.run` (`dependency-move.ts:175`), so it renders the built-in text. Keep the cross-phase parent line.

## Code Examples

### Platform leaf (pure)
```ts
// platform/subagent-child.ts
/** An environment as the process gives it. */
export type SubagentChildEnv = Readonly<Record<string, string | undefined>>;

// pi-subagents 0.84.0 names its child-host marker here
// (src/runs/shared/child-runtime-config.js:6) and sets it to "1" before any
// background child session starts (src/runs/background/subagent-runner.js:89).
const SUBAGENT_CHILD_VARIABLE = "PI_SUBAGENT_CHILD";

/** MGRT-02 / D-MB-12: whether this process hosts pi-subagents background children. */
export function isSubagentChild(env: SubagentChildEnv): boolean {
  return env[SUBAGENT_CHILD_VARIABLE] === "1";
}
```

### Lock without a state write
```ts
// Source: transaction/with-state-guard.ts:90-111 (signature), read-pass.ts:288 (no-save usage)
await withLockedStateTransaction(
  locations,
  () => rewriteAgentGrantForms(locations, active, removalOps),
  { persistMigration: false },
);
```

### The new step module's profile Pi step (Phase 4 step module)
```ts
// features/step_definitions/mcp-server/agent-grants.steps.ts
Given(
  "pi runs with the scripted model, pi-subagents, and the mcp implementation",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    const launch = mcpImplementationLaunch(this.mcpProfile);
    await this.usePiWithProfile({
      companions: ["pi-subagents", ...launch.companions],
      extraExtensions: launch.extraExtensions,
    });
  },
);
```
`mcpImplementationLaunch` (`features/lib/mcp-implementation.ts:147-151`) returns `{ companions: ["pi-mcp-adapter"], extraExtensions: [] }` under the adapter, or `{ companions: [], extraExtensions: [BUILTIN_MCP_STAND_IN_EXTENSION] }` under built-in. `usePiWithProfile(profile: PiProfile)` takes `{ companions; extraExtensions?; trust? }` (`world.ts:112-116`) and loads the companions in a fixed order. A scratch copy of this exact step ran under the builtin profile this session (see Validation Architecture).

### The background child Pi (Phase 4 step module)
```ts
Given(
  "pi runs with the scripted model and pi-subagents as a pi-subagents background child",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    const file = await writeLaunchEnvironment(this.tokens.home, { PI_SUBAGENT_CHILD: "1" });
    this.onRelease(() => rm(file, { force: true }));
    await this.usePiWithProfile({
      companions: ["pi-subagents"],
      extraExtensions: [PI_LAUNCH_ENVIRONMENT_EXTENSION],
    });
    assert.deepStrictEqual(await readAppliedLaunchEnvironments(this.profileHarness()), [
      { PI_SUBAGENT_CHILD: "1" },
    ]);
  },
);
```
`writeLaunchEnvironment` writes with `flag: "wx"` (`pi-launch-environment.ts:47-55`). The launch-environment extension throws when the file is missing (`:76-85`), so keep the file while the Pi and its restarts run. Copy the pattern from `listing.steps.ts:122-135`. Keep the word "mcp" out of the step text, because the autoapply leg is not an MCP scenario. With no adapter, the Pi runs built-in under both profiles (Pitfall 6).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Agent files carry only `mcp:<adapterKey>` | The selector follows the active implementation, rewritten at load after a switch | this phase | The load writes agent files (D-MB-03 amends APL-D1) |
| One async-warning text naming pi-mcp-adapter | Per-profile text; the adapter text is unchanged | this phase | User-visible staging warning under built-in |
| A child Pi applies autoapply and moves MCP entries | A child runs only the read-only pass | this phase | MGRT-02 |

**Deprecated/outdated:** none.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pi awaits `session_start` handlers before it serves the first prompt, so the rewrite lands before a `subagent` call | Pattern 4 | A first prompt could read the old form; the scratch probes show it in practice, but the await itself was not read [ASSUMED] |
| A2 | Phase 2's built-in registration registers exactly the recorded servers that `profileFor("builtin").classify` supports, so the built-in form's server set matches what is served | Pattern 5 | A granted server could not resolve (launch error) [ASSUMED] |
| A3 | Phase 3 keeps `resolved.mcpServers` as the adapter-supported subset (frozen interface 4 says so) | Pattern 5 | The adapter form would change [CITED: 01-FROZEN.md interface 4] |
| A4 | A real background child's `ctx.mode` is `print` and its load prints its pending block into the child session (an existing behavior this phase keeps) | Pattern 6 | Noise in a child's output, not a state change [ASSUMED from CONTEXT, not re-read] |

## Open Questions (RESOLVED)

1. **Active implementation in cascade updates (autoupdate, apply converge).**
   - What we know: `CascadeThreePhaseArgs.run?: never`, and only dependency moves can carry `preflightNotification.run`. Both callers of `beginPluginUpdateRun` pass `{ ctx, run }` (`edge/handlers/marketplace/update.ts:62`, `background-pass.ts:403`), but that run reaches only `settleDependencies`. `apply.ts:1811` has its run in scope when it calls `convergePlugin`.
   - What's unclear: whether Phase 3 adds an implementation field to `ThreePhaseArgs` (its research says it will thread one).
   - RESOLVED: Phase 4 uses the fallback chain (run, then `preflightNotification.run`, then `none`, which renders the adapter form), and the next load rewrites the file. It plumbs no new field through `update-flow.ts`, `orchestrators/types.ts`, or `apply.ts` (unowned files, and a conflict risk with Phase 3). Parent line: after Phase 3 merges, point the agent staging function at Phase 3's field. Log it as a dubious choice.
2. **Trust leg in cucumber.**
   - What we know: pi-subagents runs no project agent in an untrusted project (`features/agent/project-trust.feature`), so `subagent get` cannot show an untrusted project's agent file.
   - RESOLVED: cover D-LOC-01 in `agent-grants-step.test.ts` (untrusted means the project scope is untouched and the user scope is rewritten). No cucumber scenario. Log it.
3. **Red proof of the child grants leg.**
   - RESOLVED: put the child grants leg and the child autoapply leg in two scenarios. The autoapply leg is red on the pre-phase tree (the child installs). The grants leg is red only with the gate removed: record that mutation run in the SUMMARY, and log it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | yes | v24.22.1 | — |
| `@earendil-works/pi-coding-agent` | cucumber profile Pis | yes | 1.5.0 | — |
| pi-subagents (optional peer cache) | cucumber, integration conformance | yes | 0.84.0 | `node scripts/install-test-peers.mjs` |
| pi-mcp-adapter (optional peer cache) | adapter profile | yes | 7.0.0 | same |
| `setpriv` (nondac wrapper) | running npm scripts as root | yes | `/usr/bin/setpriv` | — |
| `pre-commit` | commits | yes | `/root/.local/bin/pre-commit` | — |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` + `strong-mock` (unit, integration), `@cucumber/cucumber` (behavioral, `adapter` and `builtin` profiles) |
| Config file | `package.json` scripts, `cucumber.json` (frozen), `.fallowrc.json` (frozen) |
| Quick run command | `node --test test/bridges/agents/convert.test.ts` (any one owner test) |
| Direct coverage of one pair | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/<path>.ts` |
| Full suite command | `npm run check` in parts: `npm run check:static`, `npm run test:unpaired`, `npm run test:integration`, `npm run test:coverage:direct:all`, `npm run test:cucumber:profile -- --profile adapter features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow`, the same with `features/marketplace features/plugin`, `npm run test:cucumber:profile -- --profile builtin features`; the phase gate adds `npm run test:modules` |

Prefix every npm script with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/f243baba-9933-5a9c-bf6c-1345067f42f7/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. Warm ESLint with a lone `npm run lint` first.

### Measured facts for the scenarios (scratch cucumber runs this session, not committed)

- The existing `features/mcp-server/agent-grants.feature` under adapter: 3 passed, 18.6 s serial (`--parallel 1`). A profile-Pi start took 2.3 s warm and 9.8 s cold, the first jiti compile.
- **Builtin profile, pre-phase tree:** a scratch scenario (stand-in, profile Pi with pi-subagents and the stand-in, listing wait, then `subagent get` and a foreground launch) produced `subagent returned: agent demo:runner\npath {agent dir}/agents/pi-claude-marketplace-demo-runner.md\ndescription Calls the tools the task names.\naliases pi-claude-marketplace-demo-runner\ntools mcp:plugin_demo_stub_/echo\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync true\nsystem prompt:\nCall the tools the task names.` and `subagent failed: error naming plugin_demo_stub_/echo`. The raw text was `selects MCP tools that Pi's built-in MCP does not offer: mcp:plugin_demo_stub_/echo. The server may be missing, disconnected, still connecting, or its tools hidden; check /mcp.`
- **Builtin profile, file edited to the built-in form** (`tools: mcp:plugin_demo_stub/echo`): `tools mcp:plugin_demo_stub/echo`, and `subagent failed: error` with today's projection. The raw text was `selects MCP tools from servers that extensions registered (plugin_demo_stub). Only background children (async: true) load those extensions; run the agent in the background or add the server to the global mcp.json or a trusted project's .pi/mcp.json.` This also confirms that the stand-in's **deferred** tools resolve: `resolveBuiltinMcpSelections` excludes only `exposure === "hidden"` (`bundle/chunk-V2BZYLEP.js:532-546`). Pi's `getAllTools()` lists every MCP tool definition with `exposure` and `namespace` (`dist/core/agent-session.js:1110-1121`, `dist/extensions/mcp/index.js:287-316`).
- **Child Pi:** a profile Pi with `companions: ["pi-subagents"]` and the launch environment `{ PI_SUBAGENT_CHILD: "1" }` logged `APPLIED [{"PI_SUBAGENT_CHILD":"1"}]` and still offered the `subagent` tool. It ran built-in under the adapter profile. 12.7 s serial, including the run start.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | RED proof (pre-phase) | File Exists? |
|--------|----------|-----------|-------------------|-----------------------|-------------|
| MGRT-01 | Built-in form: `mcp:plugin_<p>_<s>` and `/<tool>`; built-in exclude name; built-in async text; the adapter bytes unchanged; an `sse` grant dropped under built-in only | unit | `node --test test/bridges/agents/convert.test.ts` | The new cases fail (no implementation input) | ✅ (add cases) |
| MGRT-01 | The parts emitter: frontmatter + body = file | unit | `node --test test/bridges/agents/frontmatter.test.ts` | Fails (no parts function) | ✅ |
| MGRT-01 | Stage stores `mcpImplementation` and `mcpForms` only when the forms differ; leaves out an inactive AG-11-empty form; the active form is in the file; `none` writes the adapter form | unit | `node --test test/bridges/agents/stage.test.ts` | Fails | ✅ |
| MGRT-01 | Schema accepts the new optional fields, rejects a bad `mcpImplementation`; I/O round-trips them | unit | `node --test test/persistence/agents-index-schema.test.ts test/persistence/agents-index-io.test.ts` | Fails | ✅ |
| MGRT-01 | `agentsPhase` passes the snapshot implementation and the declared servers (builtin run gives a built-in file) | unit (own cases only) | `node --test --test-name-pattern 'MGRT-01' test/orchestrators/plugin/install-outcome.test.ts` | Fails | ✅ |
| MGRT-01 | Update agent staging: direct run, then `preflightNotification.run`, then `none` | unit (own cases only) | `node --test --test-name-pattern 'MGRT-01' test/orchestrators/plugin/update-swap.test.ts` | Fails | ✅ |
| MGRT-01 | Rewrite: the recorded form is swapped atomically; the active-form file gets only its row fixed; an edited, missing, foreign, or out-of-tree file is left; the index is saved last; `none` changes nothing; untrusted means user scope only; a held lock skips the scope; a pristine scope creates nothing; it never rejects | unit | `node --test test/orchestrators/mcp/agent-grants-step.test.ts test/bridges/agents/<rewrite>.test.ts` | Fails (seed no-op) | ✅ step, ❌ Wave 0 for the new bridge module |
| MGRT-01 | Built-in selectors resolve in pi-subagents' own resolver (`resolveMcpDirectToolResolution` with a host whose `getCommands` lists `mcp` from `builtin:mcp` and whose `getAllTools` lists `profile.toolName(...)` with namespace `mcp__<folded>`) | integration (optional) | `node --test test/integration/agents-builtin-grant-conformance.test.ts` (after `node scripts/install-test-peers.mjs`); import with `importPeerModule(peer, "src", "runs", "shared", "mcp-direct-tool-allowlist.js")` (`test/integration/optional-peer.ts:125`) | n/a (conformance) | ❌ Wave 0 |
| MGRT-01 | Install shows the profile's selector in `subagent get` (`@adapter-only` `tools mcp:plugin_demo_stub_/echo` / `@builtin-only` `tools mcp:plugin_demo_stub/echo`) | cucumber | `npx cucumber-js --profile builtin features/mcp-server/agent-grants.feature` and `--profile adapter` | builtin: `_/echo` measured above; adapter leg is a regression pin | ✅ (edit) |
| MGRT-01 / D-CF6-10 | Foreground refusal names the profile's selector or server (`error naming plugin_demo_stub_/echo` / `error naming plugin_demo_stub`) | cucumber | same | builtin: `error naming plugin_demo_stub_/echo` measured above | ✅ (edit) |
| MGRT-01 | Update, reinstall, and enable re-stage in the active form (`subagent get` in the same session, no new session, so the load step cannot mask the staging) | cucumber | same | builtin: adapter form pre-phase | ❌ |
| MGRT-01 | Built-in async warning in the install's diagnostic `lines` (`@builtin-only`) | cucumber | same | builtin: adapter text pre-phase | ❌ |
| MGRT-01 / D-MB-03 | Switch: an adapter-form install, then a restart onto built-in, gives `tools mcp:plugin_demo_stub/echo`, and a `tools: Read` agent stays `tools read` (`@own-implementation`; for example `Given the user's pi settings turn off pi's built-in mcp`, a profile Pi with `pi-subagents`, install, script, then `When the user restarts pi with pi's built-in mcp turned on`) | cucumber | `npx cucumber-js --profile adapter features/mcp-server/agent-grants.feature` | `_/echo` pre-phase | ❌ |
| MGRT-01 | No MCP keeps the file: an install under built-in, then `When the user restarts pi with no mcp`, still shows `mcp:plugin_demo_stub/echo` | cucumber (`@own-implementation`) | same | pre-phase shows `_/echo` (install side) | ❌ |
| MGRT-02 | `isSubagentChild` reads `"1"` only | unit | `node --test test/platform/subagent-child.test.ts` | Fails (no module) | ❌ Wave 0 |
| MGRT-02 | In a child the load skips autoapply and the MCP move but keeps the read-only pass | unit (new cases in an unowned pair) | `node --test --test-name-pattern 'MGRT-02' test/orchestrators/reconcile/load.test.ts` | Fails | ✅ |
| MGRT-02 | A child Pi with autoapply on installs nothing: the session reports the pending block (`will install`), and `Then the project scope has no installed plugins` | cucumber (no implementation tag; runs under adapter) | `npx cucumber-js --profile adapter features/mcp-server/agent-grants.feature` | pre-phase child applies (red) | ❌ |
| MGRT-02 | A child Pi (built-in active) leaves an adapter-form agent: `tools mcp:plugin_demo_stub_/echo` | cucumber (`@own-implementation`) | same | **mutation red only** (gate removed); passes on the pre-phase tree | ❌ |

### Sampling Rate
- **Per task commit:** the owner tests of the staged pairs; the hook runs `npm run check:commit` (static checks, unpaired tests, direct coverage of the staged pairs).
- **Per wave merge:** `npm run check` (in parts) plus both cucumber profiles on the combined tree.
- **Phase gate:** the full suite, `npm run test:modules`, and both cucumber profiles, with seeds recorded.

### Wave 0 Gaps
- [ ] `test/platform/subagent-child.test.ts`, which covers MGRT-02 (pairing requires it)
- [ ] `test/bridges/agents/<rewrite module>.test.ts`, which covers MGRT-01 switch side (pairing requires it)
- [ ] `test/orchestrators/mcp/agent-grants-step.test.ts`, rewritten (the seed's strong-mock "reads nothing" case no longer holds)
- [ ] Optional: `test/integration/agents-builtin-grant-conformance.test.ts`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes (trust gate) | D-LOC-01: no project-scope rewrite unless `ctx.isProjectTrusted()` |
| V5 Input Validation | yes | TypeBox per-row validation of `agents-index.json`; check the stored form shape (`---` frame and marker) before writing |
| V6 Cryptography | no | — |
| V12 Files and Resources | yes | `assertPathInside(locations.agentsDir, row.targetPath)` (NFR-10); the basename must equal `<generatedName>.md`; tmp and rename inside `<extensionRoot>/agents-staging/` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A hand-edited or malicious `agents-index.json` points `targetPath` outside `agents/` | Tampering | `assertPathInside` before any read or write; a row that fails is skipped and logged |
| A stored form carries injected frontmatter (for example `tools: bash`) | Tampering / Elevation | The index sits in the same scope tree as the agent files (same trust boundary). Untrusted projects are skipped (D-LOC-01). The form must have the `---` frame and `GENERATED_AGENT_MARKER` |
| A user-edited agent file is overwritten | Tampering | Rewrite only when the file starts with the recorded form byte for byte; otherwise leave it |
| A symlinked target | Tampering | `rename` replaces the link, not its target; `assertPathInside` resolves real paths |
| Two Pi processes rewrite against different probes | Repudiation / integrity | The per-scope state lock; a child never writes (MGRT-02) |
| A user sets `PI_SUBAGENT_CHILD=1` | Denial of service (self) | Only turns off load writes for that process; `/claude:plugin apply` still works |

## Sources

### Primary (HIGH confidence; read or run this session)
- Repository source: `bridges/agents/{convert,frontmatter,stage,types,marker,index-mutation,unstage,index}.ts`, `persistence/agents-index-{schema,io}.ts`, `persistence/locations.ts`, `domain/mcp-implementation.ts`, `domain/name.ts:632-672`, `domain/mcp-server-features.ts:51-54`, `domain/mcp-builtin-features.ts:45-53`, `domain/mcp-resolution.ts:346-362`, `domain/resolver-types.ts:136-170`, `orchestrators/plugin/{install-outcome,update-swap,update-flow,dependency-move,reinstall-flow,prune-rollback}.ts`, `orchestrators/mcp/{agent-grants-step,session-materialize,builtin-registration-step}.ts`, `orchestrators/reconcile/{load,read-pass,types}.ts`, `transaction/with-state-guard.ts`, `shared/{errors,debug-log,fs-utils,path-safety}.ts`, `index.ts:100-310`, `.fallowrc.json`, `rule-packs/architecture.json`, `cucumber.json`, `.github/workflows/ci.yml:119-174`, `scripts/check-features.mjs:30-603`, `scripts/check-corresponding-tests.mjs`
- Harness: `features/support/world.ts:100-130, 575-930`, `features/support/pi-process.ts:10-260`, `features/lib/{mcp-implementation,pi-launch-environment,mcp-server-files}.ts`, `features/lib/upstream/subagents.ts`, `features/step_definitions/{mcp-implementation,model,session}.steps.ts`, `features/step_definitions/mcp-server/agent-grants.steps.ts`, `features/mcp-server/{agent-grants,implementation-profiles,verdict-markers}.feature`, `features/agent/{lifecycle,frontmatter,project-trust}.feature`, `features/plugin/autoapply.feature`, `test/e2e/_rpc.ts:250-270`
- pi-subagents 0.84.0 (`node_modules/.cache/optional-peers/node_modules/pi-subagents`): `src/runs/background/subagent-runner.js:85-90`, `src/runs/shared/child-runtime-config.js:6`, `src/extension/index.js:224-227`, `index.js:5`, `bundle/chunk-V2BZYLEP.js:405-572`, `bundle/chunk-JG4QKI5M.js:1215-1245`, `src/runs/shared/mcp-direct-tool-allowlist.js:27-122`
- Pi 1.5.0 dist: `core/agent-session.js:1110-1121`, `extensions/mcp/index.js:280-320`, `extensions/mcp/tools.js:240-255`, `core/extensions/loader.js:554-575`
- Scratch probes (this session; files under the scratchpad `p4r/` folder, not committed): TypeBox extra properties, the projection regex, three cucumber probes (builtin pre-phase, builtin with the built-in form, child Pi)
- Skills: `.agents/skills/{cucumber,local-verification,typescript-unit-tests,typescript-style}/**`

### Secondary
- `origin/features/mcp-builtin-phase-3:.planning/phases/03-read-time-verdicts/03-RESEARCH.md` (Phase 3's plan to thread the implementation into `ThreePhaseArgs`)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (no new dependency; all modules read)
- Architecture: HIGH for the seams and line anchors; MEDIUM for the cascade fallback, a judgment call against Phase 3's parallel change
- Pitfalls: HIGH (projection regex, child-env ordering, and refusal texts reproduced this session)

**Research date:** 2026-11-04
**Valid until:** the Phase 3 merge (re-check `ThreePhaseArgs` and the verdict-markers row), or 30 days
