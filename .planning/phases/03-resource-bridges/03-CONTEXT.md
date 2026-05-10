# Phase 3: Resource Bridges - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

## Phase Boundary

All four resource bridges (skills, commands, agents, MCP servers) stage and unstage atomically. Each bridge owns its own `prepare/commit/abort/unstage` primitive set with marker discipline and per-bridge collision/ownership guards. Phase 3 owns 33 v1 REQ-IDs (SK-1..5, CM-1..4, AG-1..12, MC-1..8, RN-4..6, AS-8, AS-9) and produces:

- `bridges/skills/{prepare,commit,abort,unstage}.ts` -- directory copy + atomic rename per skill into `<scope>/claude-marketplace/resources/skills/<plugin>-<skill>/`
- `bridges/commands/{prepare,commit,abort,unstage}.ts` -- per-file write + atomic rename into `<scope>/claude-marketplace/resources/prompts/<plugin>:<command>.md`
- `bridges/agents/{prepare,commit,abort,unstage,index,convert,frontmatter}.ts` -- tmp staging dir, atomic rename of agent files into `<scope>/agents/`, atomic JSON write of `agents-index.json`, AG-7 field-mapping pipeline
- `bridges/mcp/{prepare,commit,abort,unstage,parse,merge,slots}.ts` -- in-memory merge of `<scope>/mcp.json` with `_claudeMarketplace` markers, MCP_COLLISION_SLOTS check across 4 pi-mcp-adapter slots
- `shared/vars.ts` -- `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` substitution helper (consumed by skills + commands bridges)
- `persistence/agents-index-schema.ts` -- TypeBox schema + JIT validator for `agents-index.json` (schemaVersion 1)

This phase ends with `npm run check` green, every bridge primitive callable in isolation by Phase 5 orchestrators, and a unit-test corpus that exercises (a) fresh install on each bridge, (b) re-stage on each bridge, (c) uninstall on each bridge, (d) the foreign-content / cross-owner collision refusals.

<decisions>
## Implementation Decisions

### Bridge Interface Contract (D-01)

- **D-01 (Per-bridge concrete signatures with opaque `Prepared<bridge>` handles):** Each bridge exports its own typed `prepare(input): Prepared<bridge>`, `commit(prep): Promise<CommitResult>`, `abort(prep): Promise<void>`, `unstage(target): Promise<UnstageResult>`. **No uniform `Bridge<P>` interface.** The four bridges' IO shapes diverge materially (directory copy vs file rename vs JSON merge), and a shared interface would force every consumer through a lossy abstraction. The unified surface lives at the **ledger entry shape** (Phase 5's `Phase<C>` literal-array), not at the bridge function level. Each bridge's `Prepared<bridge>` is a discriminated brand opaque to orchestrators (they pass it back into `commit`/`abort` without reading it).
- **D-01 corollary:** `bridges/` may NOT import from `transaction/` (Phase 1 D-11). Bridges expose primitives only -- they have no knowledge of `runPhases` or `Phase<C>`. Phase 5 orchestrators import from both `bridges/` and `transaction/` and do the wiring.

### Bridge ↔ Phase-Ledger Composition (D-02)

- **D-02 (Bridges expose primitives; Phase 5 orchestrators wire them):** Phase 3 ships bridges with `prepare/commit/abort/unstage` as raw functions and unit-tests each in isolation. Phase 5's `orchestrators/install.ts` (and `update.ts`, `uninstall.ts`) is the only consumer that composes them into a `runPhases<InstallCtx>` ledger. **The composition pattern is bridge-as-Phase, not prep+commit split**: each bridge maps to one literal `Phase<C>` entry where `do = bridge.commit(prep)` and `undo = bridge.unstage(target)`. The 4-phase install order from PRD §5.7 (skills → commands → agents → MCP → state-commit) materializes as a 5-element literal-array ledger in Phase 5. This documentation is captured in Phase 3 to forward the contract to Phase 5's planner; the wiring code itself is Phase 5 work.
- **D-02 rationale:** Phase 1 D-11's import boundary forces bridges to be ledger-agnostic primitives. Splitting prepare and commit into separate phases (the 8+1-phase alternative) was rejected because (a) bridge-internal staging tmp is a private implementation detail, not a ledger phase; (b) prepare's failure mode is "bridge couldn't even stage" -- it never produced anything to commit, so the ledger doesn't need to track it as a separate undoable step; (c) Phase 2 D-01's literal-array discipline reads cleaner with 5 entries than with 9.

### Agent Conversion Module Organization (D-03)

- **D-03 (Co-located in `bridges/agents/`):** Frontmatter parse + emit (AG-6, AG-8) and AG-7 field mapping live in `bridges/agents/{frontmatter,convert}.ts`. **Not in `domain/`.** AG-7's mappings (`Read` → `read`, `sonnet` → `anthropic/claude-sonnet-4-6`, etc.) are tightly coupled to a specific upstream format (Claude agent frontmatter) and a specific target format (pi-subagents frontmatter); they are single-consumer logic. `domain/` stays reserved for primitives that multiple bridges and orchestrators touch (manifest, source, resolver, name, version). Mirrors V1's `agent/{convert,frontmatter}.ts` split which was correct.
- **D-03 corollary:** Tests live at `tests/bridges/agents/{frontmatter,convert}.test.ts` -- pure-logic tests with fixture inputs/outputs. The AG-11 "no tools" throw and AG-12 source-name-collision throw both surface in `convert.ts`'s public function and are tested there.

### Re-Staging Strategy (D-04)

- **D-04 (Compute-target-then-atomic-apply per bridge):** Each bridge's `commit` uniformly does: (1) identify owned artefacts via index/state/marker check; (2) compute target spec = (existing-not-owned ∪ new-staged); (3) atomic-apply. Install (no previous), uninstall (no new, drop owned), and update re-stage (drop owned + add new) collapse into the same primitive -- they are different inputs to the same operation. This locks the "unstage-first vs swap-and-commit" question by making it a non-question: there is no distinct unstage step inside commit; there is one compute-and-apply.
- **D-04 atomic-apply granularity by bridge:**
  - **Skills:** Per-skill directory rename. Stage `agents-staging`-equivalent under `<scope>/claude-marketplace/resources/skills-staging/<uuid>-<plugin>-<skill>/`, then atomic-rename to `<scope>/claude-marketplace/resources/skills/<plugin>-<skill>/`. Same-FS guarantee (same scope root).
  - **Commands:** Per-file atomic rename. Stage `<plugin>:<command>.md` to a tmp adjacent to the prompts dir, atomic-rename to `<scope>/claude-marketplace/resources/prompts/<plugin>:<command>.md`. (Per-file is atomic per-OS rename guarantee.)
  - **Agents:** Per-file atomic rename matching V1. Stage each agent file under `<extensionRoot>/agents-staging/<uuid>/<basename>.md`, atomic-rename per-file to `<scope>/agents/claude-marketplace-<plugin>-<agent>.md`, then `atomicWriteJson(agents-index.json)`. Per-AG-10, the staging dir lives under the extension's `agents-staging/`, NOT under `<scope>/agents/`. Cross-file consistency relies on (a) ledger ordering, (b) marker discipline making unstage idempotent.
  - **MCP:** In-memory merge per MC-6. Read current `<scope>/mcp.json`, drop entries with `_claudeMarketplace.{plugin,marketplace}` matching the current operation, add new entries with the marker, `atomicWriteJson(<scope>/mcp.json)`. The "noop" branch (no new servers AND no previous ours) MUST NOT materialize the file (PRD §5.8 MC-6 + Phase 3 success criterion 4).
- **D-04 corollary:** `abort(prep)` cleans up the bridge's own staging tmp (e.g., `agents-staging/<uuid>/`); it is invoked when the bridge's own commit threw partway. Once commit returns successfully, `abort` is a no-op -- rollback is `unstage`, not `abort`. Phase 5's ledger uses `unstage` as `Phase.undo`, not `abort`.

### Same-Bridge Collision & Cross-Owner Refusal (D-05)

- **D-05 (Per-bridge collision detection; cross-bridge guard is Phase 5):** Each bridge enforces same-bridge collisions and cross-owner refusals during `prepare`:
  - **Skills:** No same-name conflict possible within a single plugin (RN-1 generated names are unique by construction); cross-marketplace collisions on the same generated `<plugin>-<skill>` directory refuse stage with the conflicting owner.
  - **Commands:** Same as skills.
  - **Agents:** AG-9 cross-(marketplace, plugin) refusal -- if a target file basename `claude-marketplace-<plugin>-<agent>.md` exists and the marker check (D-06 below) shows it's owned by a DIFFERENT (marketplace, plugin), throw with `"<name>" already owned by <other-mp>/<other-plugin>"`. Same-(marketplace, plugin) self-replace is allowed. AG-12 source-name collisions inside a single plugin throw with both source names listed.
  - **MCP:** MC-4 server-name collisions checked across all four `pi-mcp-adapter` slots from a single `MCP_COLLISION_SLOTS` constant in `bridges/mcp/slots.ts`. Self-replace within the same scope's `mcp.json` is allowed; foreign collisions refuse stage.
- **D-05 corollary:** **Cross-bridge guard (PI-6: skill name == command name == agent name)** runs in Phase 5's `orchestrators/install.ts` BEFORE any bridge's `prepare` is invoked. Phase 3 does NOT cross-check between bridges -- bridges are siloed primitives.

### Marker Discipline & Foreign-Content Refusal (D-06)

- **D-06 (Markers per bridge):**
  - **Skills:** No marker required (the directory name `<plugin>-<skill>` and its location under `claude-marketplace/resources/skills/` is the marker; foreign content is impossible because we own the entire directory tree).
  - **Commands:** Same -- the file path is the marker.
  - **Agents:** **Two-part marker** per AG-5 -- (a) basename starts with `claude-marketplace-`, (b) body contains the verbatim `generated by pi-claude-marketplace` string inside an HTML-comment provenance block placed immediately after the closing `---` of the frontmatter. Removal MUST refuse to touch any file failing either check (foreign content). The HTML-comment block is emitted by `bridges/agents/frontmatter.ts` during commit; the marker check is the gate inside `unstage` and `prepare`'s overwrite-detection.
  - **MCP:** `_claudeMarketplace: { plugin, marketplace }` field embedded in each staged server entry per MC-5. Unstage drops only entries where this field's `(plugin, marketplace)` tuple matches.
- **D-06 corollary (Phase 3 success criterion 2 binding):** "Every staged agent file starts with `claude-marketplace-` AND contains the verbatim `generated by pi-claude-marketplace` HTML-comment marker; foreign content at a target file is retained in the index with `failed[]` and is not overwritten." The `failed[]` channel is the agents bridge's prepare-time refusal: foreign-target files do NOT block the install but DO surface as warnings in the bridge's `CommitResult.failed[]`. Phase 5 aggregates these into the user-visible message.

### agents-index.json Schema (D-07)

- **D-07 (TypeBox schema in `persistence/agents-index-schema.ts`, JIT-compiled validator):** `agents-index.json` (schemaVersion 1) gets a TypeBox schema mirroring AG-2's fields (`plugin`, `marketplace`, `sourceAgent`, `generatedName`, `sourcePath`, `targetPath`, `sourceHash`, `originalModel?`, `droppedFields`, `droppedTools`, `warnings`). Compiled validator (`AGENTS_INDEX_VALIDATOR`) exported alongside. This follows Phase 2 D-07's pattern (top-level JIT compile at module load). Per-row validation soft-fails (drop the row, surface `agent index corruption (entry dropped)` warning); file-level corruption (invalid JSON, missing `schemaVersion`, missing `entries[]`) throws (AG-4).
- **D-07 location:** `persistence/agents-index-schema.ts` -- alongside `state-schema.ts` from Phase 2. Multiple consumers (`bridges/agents/index.ts` and any future inspection tool) touch it, so it belongs in `persistence/` not `bridges/agents/`. The IO-side reader/writer (`loadAgentsIndex`, `saveAgentsIndex` using `atomicWriteJson`) lives in `persistence/agents-index-io.ts`. The bridge-level mutation logic (compute next index from prev + new entries) lives in `bridges/agents/index.ts`.

### Variable Substitution (D-08)

- **D-08 (`shared/vars.ts` for `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}`, applied to skills + commands + agents):** SK-4 mandates substitution in `SKILL.md`; CM-3 mandates substitution in command bodies; **PRD §5.2.1 PI-10 mandates substitution in agent bodies as well** (verified against PRD on 2026-05-10 -- PI-10 is the binding requirement that lists all three component types). The substitution helper is a pure function `substituteClaudeVars(body: string, vars: { pluginRoot, pluginData }): string` -- exported from `shared/vars.ts` because all three bridges consume it. Variables: `${CLAUDE_PLUGIN_ROOT}` resolves to the absolute `pluginRoot` path (already constrained by `assertPathInside`); `${CLAUDE_PLUGIN_DATA}` resolves to `<scopeRoot>/claude-marketplace/data/<marketplace>/<plugin>/` (per PRD §4 / §8.1). The `data/` subdir creation lives in Phase 5's install orchestrator (after the bridge state commit), NOT in Phase 3 -- bridges only emit the substituted string; the dir doesn't need to exist for substitution to be byte-correct.

#### D-08 Decision Update (2026-05-10)

The original D-08 wording said "Agents do NOT need substitution in their bodies (no AG-* requirement)." This was incorrect -- PRD §5.2.1 PI-10 binds substitution across skills, commands, AND agents. RESEARCH.md Open Question #2 (A2) flagged the conflict; the resolution is that PI-10 prevails (PRD is the spec; D-08's original wording reflected the absence of a per-AG-* requirement, but PI-10 covers all three component types and matches V1 behavior). **Binding effect:** the helper in `shared/vars.ts` is consumed by skills, commands, and agent bridges. Plan 03-05's `convertAgent` calls `substituteClaudeVars` on the agent body. This is RECORDED here so downstream plan executors see the change in CONTEXT.md, not just in plan prose. Related: W-08 (foreign-content surfacing via `failed[]` not throw on AG-5 prepare-time) is now consistent with D-06 corollary -- see Plan 03-05 prose.

### Resource Naming (D-09)

- **D-09 (Reuse Phase 2 `domain/name.ts`; add SK-2/CM-2 prefix-elision helpers if not already present):** Phase 2 D-05 already shipped `assertSafeName` + the three generators (`<plugin>-<skill>`, `<plugin>:<command>`, `claude-marketplace-<plugin>-<agent>`). Phase 3 verifies they handle SK-2 ("prefix elided when source skill name already starts with `<plugin>-`") and CM-2 ("`<plugin>-` prefix stripped from source name when present"). If the Phase 2 helpers don't yet handle the elision, Phase 3 ADDS the elision logic to `domain/name.ts` (NOT in bridges/) since it's reusable name generation. **Verification step in Phase 3 plan:** read `domain/name.ts` and confirm; if missing, add and add tests.

### resources_discover (D-10)

- **D-10 (Phase 3 ships the discovery shape; orchestrator wiring is Phase 7):** SK-5 requires `resources_discover` to report skills/ directories from both scopes with per-scope failure aggregation. Phase 3 ships a `bridges/skills/discover.ts` (or equivalent) that, given `ScopedLocations`, returns the discovered skill directories from one scope + an aggregated error if the scope's read failed. Phase 7's `index.ts` calls this for each scope and aggregates per-scope failures into a single thrown error per SK-5. **Phase 3 does NOT register the `resources_discover` event handler** -- that's edge/integration work for Phase 7. Phase 3 just provides the per-scope helper.

### Claude's Discretion

The user said "i'll leave it to you" on every gray area presented. Each decision above is Claude's call, captured here so downstream agents (researcher, planner, executor) know the rationale and have flexibility within the locked decision:

- **D-01 (per-bridge concrete signatures):** Claude chose this over a uniform `Bridge<P>` interface because Phase 1 D-11's import boundary forbids bridges from importing `transaction/`, and the four bridges' IO shapes are too divergent for a non-lossy shared interface. Escalation: if Phase 5's orchestrator code becomes repetitive across install/update/uninstall, consider extracting a `BridgeOps<Prep, Target>` shared type in `orchestrators/types.ts` (NOT in `bridges/`).
- **D-02 (bridge-as-Phase composition):** Claude chose 5-Phase ledger over 8+1-Phase split. Escalation: if a real failure mode shows that prepare-stage abort is too coarse-grained (e.g., multi-file partial commits leaving inconsistent state), the prep+commit split can be revisited in Phase 5 without changing Phase 3's bridge surfaces -- bridges stay primitives.
- **D-03 (agent conversion in bridges/agents/):** Claude chose co-location over `domain/agent-mapping.ts`. Escalation: if a future feature (e.g., a "preview" tool that converts an agent without staging) needs the conversion logic in isolation, the file can be moved into `domain/` and re-imported -- at most a one-commit refactor.
- **D-04 (compute-target-then-atomic-apply):** Claude chose the unified primitive over distinct unstage-first vs swap-and-commit modes. The primitive is the V1 pattern.
- **D-05 (per-bridge collision; cross-bridge in Phase 5):** Claude chose siloed bridges over Phase 3 owning PI-6. PI-6 is in §5.2.1 (Plugin Lifecycle), which is Phase 5's domain.
- **D-07 (agents-index schema in `persistence/`):** Claude chose `persistence/` over `bridges/agents/` for the schema, mirroring Phase 2 D-09's `state-schema.ts` placement. The bridge-side mutation logic stays in `bridges/agents/index.ts` -- only the schema definition + validator + IO live in `persistence/`.
- **D-08 (`shared/vars.ts`):** Claude chose `shared/` over per-bridge duplication because both skills and commands consume the same substitution rule.
- **D-10 (resources_discover helper-only in Phase 3):** Claude chose to defer the actual `resources_discover` event registration to Phase 7's `index.ts`. Phase 3 ships the per-scope helper that Phase 7's aggregator calls.

</decisions>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary spec (PRD)

- `docs/prd/pi-claude-marketplace-prd.md` -- V1 PRD; authoritative spec for the successor
- `docs/prd/pi-claude-marketplace-prd.md` §5.5 -- SK-1..5 skills bridge requirements
- `docs/prd/pi-claude-marketplace-prd.md` §5.6 -- CM-1..4 commands bridge requirements
- `docs/prd/pi-claude-marketplace-prd.md` §5.7 -- AG-1..12 agents bridge requirements; AG-7 detail (frontmatter field mappings) is the spec for `bridges/agents/convert.ts`
- `docs/prd/pi-claude-marketplace-prd.md` §5.8 -- MC-1..8 MCP servers bridge requirements; MC-1 precedence chain (entry > manifest > standalone .mcp.json) is the spec for `bridges/mcp/parse.ts`
- `docs/prd/pi-claude-marketplace-prd.md` §6.5 -- RN-1..6 resource naming + `assertSafeName`; RN-4..6 are Phase 3 deliverables (RN-1..2 landed in Phase 2)
- `docs/prd/pi-claude-marketplace-prd.md` §6.10 -- PS-1..5 path safety; SC-7 path containment for every name-derived path (agent target paths, recorded skill/prompt paths)
- `docs/prd/pi-claude-marketplace-prd.md` §6.11 -- AS-1..AS-9 atomic staging; AS-8/9 are Phase 3 (per-bridge atomic commit semantics)
- `docs/prd/pi-claude-marketplace-prd.md` §6.12 -- ES-5 marker strings (Phase 3 emits the `pi-subagents is not loaded` and `pi-mcp-adapter is not loaded` warnings via `notifyWarning`; also constrains the `_claudeMarketplace` marker shape)
- `docs/prd/pi-claude-marketplace-prd.md` §8.1 -- Per-plugin state shape (`resources.skills`, `resources.prompts`, `resources.agents`, `resources.mcpServers`); the bridge `CommitResult.recorded` fields populate these
- `docs/prd/pi-claude-marketplace-prd.md` §9.2 -- Persistence layout per scope (where each bridge writes)
- `docs/prd/pi-claude-marketplace-prd.md` Appendix B -- Generated-name conventions (skill: `<plugin>-<skill>`; command: `<plugin>:<command>`; agent: `claude-marketplace-<plugin>-<agent>`)

### Project planning

- `.planning/PROJECT.md` -- Project context; Key Decisions table; constraints (NFR-1, NFR-7, NFR-10 still binding for Phase 3)
- `.planning/REQUIREMENTS.md` -- All v1 REQ-IDs; Phase 3 owns the 33 listed under § "Per-phase counts" for Phase 3 (SK, CM, AG, MC, RN-4..6, AS-8..9)
- `.planning/ROADMAP.md` -- Phase 3 goal + 5 success criteria (lines 80-90)
- `.planning/STATE.md` -- Current state; Phase 2 complete (188 tests, all decisions D-01..D-12 shipped)

### Phase 1 carry-forward (consumed by Phase 3)

- `.planning/phases/01-foundations-toolchain/01-CONTEXT.md` -- D-03 (`write-file-atomic@^8` for JSON), D-06/D-07 (notify wrappers + ESLint output discipline), D-08 (markers), D-11 (import boundaries: `bridges/` may import only from `domain/`, `persistence/`, `shared/`), D-14..17 (`assertPathInside` with symlink refusal -- every bridge target path goes through it)
- `extensions/claude-marketplace/shared/atomic-json.ts` -- `atomicWriteJson` (Phase 3 uses for `mcp.json` and `agents-index.json`)
- `extensions/claude-marketplace/shared/markers.ts` -- ES-5 strings (Phase 3 emits via `notifyWarning`)
- `extensions/claude-marketplace/shared/notify.ts` -- `notifySuccess/Warning/Error` (every Phase 3 user-visible message routes through these)
- `extensions/claude-marketplace/shared/path-safety.ts` -- `assertPathInside` with `SymlinkRefusedError` (Phase 3 calls on every name-derived path)
- `extensions/claude-marketplace/shared/errors.ts` -- `PathContainmentError` chain; Phase 3 adds new error types here (`AgentForeignContentError`, `McpServerCollisionError`, `BridgeStagingError` as needed)

### Phase 2 carry-forward (consumed by Phase 3)

- `.planning/phases/02-domain-core-persistence-primitives/02-CONTEXT.md` -- D-04/D-05 (resolver + name.ts), D-09 (state shape with `marketplaces[mp].plugins[plugin]`), D-01..D-03 (Phase 5 will use these to wire bridges; Phase 3 references for context)
- `extensions/claude-marketplace/domain/resolver.ts` -- Phase 3's bridges read `pluginRoot` from the `installable: true` variant of `ResolvedPlugin`; NFR-7 type discrimination ensures non-installable plugins can't reach the bridges
- `extensions/claude-marketplace/domain/name.ts` -- `assertSafeName` + the three generators; Phase 3 verifies SK-2 and CM-2 elision logic exists or adds it
- `extensions/claude-marketplace/persistence/locations.ts` -- branded `ScopedLocations` -- the only way bridges derive on-disk paths
- `extensions/claude-marketplace/persistence/state-schema.ts` -- `STATE_SCHEMA` precedent for Phase 3's `agents-index-schema.ts`

### Research foundation (already produced)

- `.planning/research/ARCHITECTURE.md` -- 9-folder layout; bridge-as-primitive boundary; literal-array ledger discipline (informs D-02 composition pattern documentation for Phase 5)
- `.planning/research/PITFALLS.md` -- Pitfall 5 (schema downgrade), 8 (union drift), 9 (foreign content), 10 (marker drift), 12 (cross-bridge symlink); D-06/D-07 mitigate
- `.planning/research/STACK.md` -- TypeBox 1.x JIT (`Schema.Compile`) -- D-07 follows this pattern
- `.planning/research/SUMMARY.md` -- Bridge layout + agents-index schema location

### Library docs (planner should pull current versions)

- `typebox` 1.1.38+ -- `Type.Object`, `Type.Union`, `TypeCompiler.Compile` for `agents-index-schema.ts` (D-07)
- `node:fs/promises` -- `rename`, `mkdir({recursive: true})`, `cp({recursive: true, force: true})`, `readdir({withFileTypes: true})`, `rm({recursive: true, force: true})` for staging tmp cleanup
- `node:crypto` -- `randomUUID()` for staging dir UUID prefixes (per AG-10)
- `write-file-atomic` 8+ -- consumed via `shared/atomic-json.ts` for `mcp.json` and `agents-index.json` writes
- `@mariozechner/pi-coding-agent` `dist/core/extensions/types.d.ts` -- `ExtensionAPI` shape for the `resources_discover` helper return type (Phase 7 owns the registration)

### V1 reference (read selectively when implementing the same concern)

- `git show features/initial:extensions/claude-marketplace/agent/{stage,convert,frontmatter}.ts` -- V1 agents bridge; AG-7 mappings + AG-8 emitter patterns
- `git show features/initial:extensions/claude-marketplace/mcp/{stage,parse,marker,effective-config}.ts` -- V1 MCP bridge; MC-1 precedence chain + MC-4 4-slot collision check
- `git show features/initial:extensions/claude-marketplace/resource/stage.ts` -- V1 skills + commands staging (the file likely covers both since they share the directory layout)
- `git show features/initial:extensions/claude-marketplace/plugin/install.ts` -- V1's 4-phase install order (informs D-02's bridge-as-Phase composition documentation)

## Existing Code Insights

### Reusable Assets (Phase 1 + Phase 2 outputs)

- **`extensions/claude-marketplace/shared/atomic-json.ts`** -- `atomicWriteJson(filePath, value)` for `agents-index.json` and `mcp.json`. Already wraps `write-file-atomic@^8`'s fsync + concurrent-write queue (Phase 1 D-03).
- **`extensions/claude-marketplace/shared/path-safety.ts`** -- `assertPathInside(parent, child)` with `SymlinkRefusedError`. Every Phase 3 path computation routes through here (SC-7).
- **`extensions/claude-marketplace/shared/notify.ts`** -- All Phase 3 user-visible messages (e.g., AG-9 `"<name>" already owned by ...`, MC-3 `malformed mcpServers: <reason>`, AS-9 staging failures) route through `notifyWarning` / `notifyError`.
- **`extensions/claude-marketplace/shared/markers.ts`** -- `PI_SUBAGENTS_NOT_LOADED`, `PI_MCP_ADAPTER_NOT_LOADED` constants. Phase 3's bridges DO NOT emit these directly; Phase 4/5 orchestrators emit them based on `pi.getAllTools()` probing (PRD §9.3). Phase 3 just provides the bridge surface.
- **`extensions/claude-marketplace/shared/errors.ts`** -- `PathContainmentError` + `SymlinkRefusedError`. Phase 3 ADDS: `AgentForeignContentError extends PathContainmentError` (refusal to overwrite non-`claude-marketplace-` agent files), `McpServerCollisionError extends Error` (4-slot collision), `BridgeStagingError extends Error` (tmp staging failure with `Error.cause`).
- **`extensions/claude-marketplace/domain/name.ts`** -- `assertSafeName` + the three generators (Phase 2 D-05). Phase 3 verifies SK-2 + CM-2 elision; adds if missing.
- **`extensions/claude-marketplace/domain/resolver.ts`** -- Bridges read `pluginRoot` from `ResolvedPlugin & { installable: true }` only.
- **`extensions/claude-marketplace/persistence/locations.ts`** -- `ScopedLocations` brand (Phase 2 D-09). All bridge target paths derive from this; new helpers may be added as needed (e.g., `skillsTargetDir(loc, pluginName, skillName)`, `agentsTargetFile(loc, pluginName, agentName)`).
- **`extensions/claude-marketplace/persistence/state-io.ts`** -- `loadState`, `saveState`. Phase 3 bridges DO NOT write state directly; Phase 5 orchestrators do that as the final state-commit phase. But the `resources.{skills,prompts,agents,mcpServers}` shapes recorded in state come from each bridge's `CommitResult`.
- **`extensions/claude-marketplace/transaction/{phase-ledger,rollback,with-state-guard}.ts`** -- Phase 5's orchestrators use these to compose bridge primitives. Phase 3 has no direct dependency.
- **`extensions/claude-marketplace/{bridges/skills,bridges/commands,bridges/agents,bridges/mcp}/`** -- Empty placeholders scaffolded by Phase 1 D-12; each has a `README.md` with allowed imports + planned contents. Phase 3 fills them.

### Established Patterns (carry forward unchanged)

- **TypeScript strict + ESM** -- All Phase 3 modules follow.
- **Import boundaries** -- `bridges/` may import only from `domain/`, `persistence/`, `shared/`. Cross-bridge imports forbidden -- if shared bridge logic emerges (unlikely), promote to `domain/` or `shared/`.
- **TypeBox JIT compile at module load (Phase 2 D-07)** -- `bridges/agents/...` and `persistence/agents-index-schema.ts` follow.
- **`npm run check` pipeline** -- typecheck + ESLint + Prettier + `node --test "tests/**/*.test.ts"` MUST stay green per NFR-6.
- **PRD-as-snapshot-fixture (Phase 1 D-09)** -- `tests/helpers/prd-extract.ts` exists. Phase 3 reuses for AG-5 marker-string assertions (the literal `generated by pi-claude-marketplace` HTML-comment is a user-contract string).
- **Pre-commit hook chain** -- unicode-dash + smartquote + mdformat + markdownlint-cli2 (.claude/ excluded; .planning/ excluded from large-file check).

### Integration Points

- **Phase 5 orchestrator import surface:** Phase 5's `orchestrators/install.ts` imports `bridges/skills`, `bridges/commands`, `bridges/agents`, `bridges/mcp` and composes them into a literal-array `Phase<InstallCtx>[]` for `runPhases`. Phase 3's bridge function signatures are the contract.
- **Phase 7 `resources_discover`:** Phase 7's `index.ts` calls `bridges/skills/discover.ts`'s per-scope helper, aggregates per-scope failures, throws on aggregated failure (SK-5). Phase 3 ships the helper but does NOT register the event.
- **`pi.getAllTools()` probing for soft-deps:** Phase 3 bridges do NOT probe; they always stage. Phase 4/5 orchestrators probe via Phase 1's notify wrapper to surface `PI_SUBAGENTS_NOT_LOADED` / `PI_MCP_ADAPTER_NOT_LOADED` warnings post-commit (per MC-8 / AS-8/9).
- **State recording:** Each bridge's `CommitResult` carries the per-plugin records (`recorded.skills`, `recorded.prompts`, `recorded.agents`, `recorded.mcpServers`) that Phase 5's orchestrator merges into `state.json` in the final state-commit phase. Phase 3 defines these shapes; Phase 5 reads them.

## Specific Ideas

- **Bridge unit-test taxonomy** -- One test file per bridge primitive: `tests/bridges/skills/{prepare,commit,abort,unstage}.test.ts`, `tests/bridges/commands/...`, `tests/bridges/agents/{prepare,commit,abort,unstage,convert,frontmatter}.test.ts`, `tests/bridges/mcp/{prepare,commit,abort,unstage,parse,merge,slots}.test.ts`. Each PRD case maps 1:1 to a test name so REQ-ID coverage is grep-able.
- **AG-5 marker snapshot test** -- `tests/architecture/marker-snapshot.test.ts` already exists for ES-5 strings. Add a case asserting that `bridges/agents/frontmatter.ts`'s emitted HTML-comment block contains the verbatim `generated by pi-claude-marketplace` string and that the parse function rejects files missing it.
- **MC-4 collision-slot fixture** -- `tests/bridges/mcp/slots.test.ts` exercises `MCP_COLLISION_SLOTS` with a fixture that places fake mcp.json files at all 4 paths (one per slot, plus the scope's own); the collision check MUST find the foreign one and refuse stage.
- **Foreign-content fixture corpus** -- `tests/bridges/agents/fixtures/foreign-agents/` ships markers-missing files (basename mismatch, marker missing) to exercise AG-5's two-part check. Both checks are gates; either failing means refuse-to-touch.
- **`@ts-expect-error` test for D-01 opaque handles** -- `tests/bridges/types.test.ts` includes a non-runtime block that attempts to pass `Prepared<skills>` to `agentsBridge.commit`; TypeScript MUST reject it. Type-level proof that the per-bridge handles aren't accidentally interchangeable.
- **MCP precedence-chain fixture** -- `tests/bridges/mcp/parse.test.ts` covers MC-1's three precedence cases (entry, manifest, standalone) AND the strict=false MM-7 conflict case (manifest/standalone declaration without entry under strict=false MUST be a "component declarations conflict" non-installable result, NOT a precedence fallback).
- **agents-index round-trip test** -- `tests/bridges/agents/index.test.ts` exercises (a) load empty → save → load returns `{schemaVersion: 1, entries: []}`, (b) per-row corruption is dropped + warned, (c) file-level corruption throws.
- **resource_discover skills helper** -- `tests/bridges/skills/discover.test.ts` covers SK-5's per-scope read; the file-level error MUST be returned (not thrown), so the Phase 7 caller can aggregate. Successful read returns the discovered SKILL.md paths.

## Deferred Ideas

- **Cross-bridge dedup helper** -- If Phase 5's PI-6 cross-plugin name guard ends up duplicating logic across install/update orchestrators, a `domain/cross-bridge-conflict.ts` helper could be extracted. Not Phase 3.
- **Agent body variable substitution** -- D-08 limits substitution to skills + commands per current PRD. If a future requirement extends to agent bodies, the helper in `shared/vars.ts` is already in place; just call it from `bridges/agents/convert.ts`.
- **`resources_discover` event registration** -- Phase 3 ships the per-scope helper; Phase 7's `index.ts` does the actual `pi.on('resources_discover', ...)` wiring + per-scope error aggregation per SK-5.
- **`pi-subagents` / `pi-mcp-adapter` probing** -- Phase 3 bridges always stage; the post-commit warning emission is Phase 4/5 orchestrator work (per PRD §9.3).
- **`Run /reload` hint generation** -- Phase 3 bridges return a `recorded` summary so orchestrators can decide whether resources actually changed; the hint string itself (PRD §6.8) is generated in Phase 4/5 orchestrators using `RELOAD_HINT_PREFIX` from `shared/markers.ts`.
- **agents-index schemaVersion v2 migration** -- Locked at v1 for V1 milestone. Tracked here so the next migration (post-milestone) can add a version-floor check at load time without rediscovering the requirement.
- **Sparse skill copy** -- Currently the entire skill directory is recursively copied. If skill dirs grow large, a hardlink-based copy could be considered (Pitfall: hardlinks across FS boundaries fail). Not Phase 3.
- **MCP entry validation beyond shape** -- MC-1 says "malformed at the matched source MUST throw". Phase 3 enforces shape (TypeBox `Type.Object({command, args?, env?, ...})`); deeper validation (e.g., resolving `command` against PATH) is Pi's runtime concern post-commit.
- **Agent `dependencies` declaration handling** -- PRD §5.2.1 PI-9 says manual-install warning for declared dependencies. Phase 5 owns the cross-plugin dependency surfacing; Phase 3's agents bridge does NOT process `dependencies` from agent frontmatter (it's a plugin-manifest field, not an agent-frontmatter field).

______________________________________________________________________

*Phase: 3-Resource Bridges*
*Context gathered: 2026-05-10*
