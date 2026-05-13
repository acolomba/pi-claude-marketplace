# Phase 3: Resource Bridges - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 3-resource-bridges
**Areas discussed:** Bridge interface contract, Bridge ↔ phase-ledger composition, Agent conversion module organization, Re-staging strategy

______________________________________________________________________

## Initial Gray Area Selection

User was presented with 4 phase-specific gray areas as a multiSelect AskUserQuestion. User responded with "i'll leave it to you" -- delegating all four decisions to Claude. Per workflow philosophy, Claude made the calls and captured them as Claude's Discretion items in CONTEXT.md with explicit rationale and escalation paths. All four areas were resolved.

## Bridge Interface Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Uniform `Bridge<P>` interface | Every bridge implements `{prepare, commit, abort, unstage}` with shared signature; orchestrator iterates them homogeneously | |
| Per-bridge concrete signatures with opaque `Prepared<bridge>` handles | Each bridge has its own typed inputs and an opaque per-bridge `Prepared` handle the orchestrator passes back. No shared interface. | ✓ |
| Hybrid (shared `BridgeOp` discriminated type + per-bridge concrete prep types) | Discriminated union for orchestrator-facing surface + per-bridge concrete types | |

**User's choice:** Delegated to Claude.
**Notes:** Claude chose per-bridge concrete signatures because (a) Phase 1 D-11 forbids `bridges/` from importing `transaction/`, so bridges can't return `Phase<C>` objects; (b) the four bridges' IO shapes diverge materially (directory copy vs file rename vs JSON merge), making a shared interface lossy; (c) the unified surface is the ledger entry shape in Phase 5, not the bridge function level.

______________________________________________________________________

## Bridge ↔ Phase-Ledger Composition

| Option | Description | Selected |
|--------|-------------|----------|
| Single Phase per bridge (5-Phase ledger) | Each bridge is one `Phase<C>`: `do = bridge.commit(prep)`, `undo = bridge.unstage(target)`. Plus a final state-commit Phase. | ✓ |
| Two Phases per bridge (8+1-Phase ledger) | Separate prepare phase (`do = stage to tmp`, `undo = abort tmp`) and commit phase (`do = atomic-rename`, no `undo`). | |
| Bridges expose primitives only; Phase 5 decides | Phase 3 ships raw functions; the composition pattern is documented for Phase 5's planner but not encoded in `bridges/`. | ✓ (paired with above) |

**User's choice:** Delegated to Claude.
**Notes:** Locked decision is the combination: bridges expose primitives in Phase 3 (forced by Phase 1 D-11's import boundary -- bridges may not import `transaction/`), and the composition pattern documented for Phase 5 is bridge-as-Phase (1:1 mapping, not prep+commit split). Rejected the 8+1 split because (a) prepare-stage tmp is a private implementation detail, not a ledger phase; (b) Phase 2 D-01's literal-array discipline reads cleaner with 5 entries than 9; (c) prepare's failure mode never produced anything to commit, so the ledger doesn't need to track it as a separate undoable step.

______________________________________________________________________

## Agent Conversion Module Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Pure logic in `domain/agent-mapping.ts` | Frontmatter parser + AG-7 field mappings + parser-safe YAML emitter live in `domain/`, reusable across consumers | |
| Co-located in `bridges/agents/{frontmatter,convert}.ts` | Two-file split mirroring V1, single bridge owns its concern | ✓ |
| Hybrid (shared frontmatter parser in `shared/`, mapping in `domain/`, emit in `bridges/`) | Three-place split for maximum granularity | |

**User's choice:** Delegated to Claude.
**Notes:** Claude chose co-location because (a) AG-7 mappings are tightly coupled to a specific upstream format (Claude agent frontmatter) and a specific target format (pi-subagents frontmatter) -- single-consumer logic; (b) `domain/` is reserved for primitives that multiple bridges and orchestrators touch (manifest, source, resolver, name, version); (c) V1's pattern (`agent/{convert,frontmatter}.ts`) was correct. Escalation: if a future feature needs the conversion in isolation (e.g., a "preview" tool), the file can be moved into `domain/` with a one-commit refactor.

______________________________________________________________________

## Re-Staging Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Unstage-first (sequential drop + add) | `prepare` drops owned files first, then stages new. V1's pattern. | |
| Swap-and-commit (build alongside, atomic-swap on commit) | Stage new artefacts to a tmp tree alongside existing, atomic-swap on commit. No transient empty window. | |
| Compute-target-then-atomic-apply per bridge | Each bridge's commit identifies owned via index/markers, computes target = (existing-not-owned ∪ new), atomic-applies. Install/uninstall/update collapse into the same primitive. | ✓ |

**User's choice:** Delegated to Claude.
**Notes:** Claude chose the unified primitive because (a) install (no previous), uninstall (no new, drop owned), and update re-stage (drop owned + add new) are different inputs to the same operation, not different operations; (b) the per-bridge atomic granularity differs (per-skill dir rename, per-command file rename, per-agent file rename + atomic JSON write for index, in-memory merge + atomic JSON write for mcp.json) -- the unified primitive lets each bridge pick the right granularity without rethinking the contract; (c) cross-file consistency relies on ledger ordering and marker discipline, both of which are already in place.

______________________________________________________________________

## Claude's Discretion

All four gray areas were Claude's call. CONTEXT.md captures each decision as a numbered D-NN entry with escalation paths so downstream agents (researcher, planner, executor) can reopen any of them if implementation reality reveals a wrong call. Additional Claude's-Discretion items captured in CONTEXT.md but not surfaced as gray areas in this discussion (because they are mechanical rather than open):

- **D-05** -- per-bridge collision detection placement (PI-6 cross-bridge guard is Phase 5)
- **D-06** -- marker discipline per bridge (skills/commands have no marker; agents have two-part marker; MCP has `_piClaudeMarketplace` field)
- **D-07** -- agents-index.json schema location (`persistence/agents-index-schema.ts`)
- **D-08** -- variable substitution helper (`shared/vars.ts` for skills + commands; agents excluded)
- **D-09** -- naming reuses Phase 2 `domain/name.ts`; SK-2 + CM-2 elision verified or added
- **D-10** -- `resources_discover` helper-only in Phase 3; registration deferred to Phase 7

## Deferred Ideas

- Cross-bridge dedup helper (`domain/cross-bridge-conflict.ts`) -- Phase 5 if needed
- Agent body variable substitution -- helper exists; future requirement can extend
- `resources_discover` event registration -- Phase 7's `index.ts`
- `pi-subagents` / `pi-mcp-adapter` probing for soft-dep warnings -- Phase 4/5 orchestrators
- `Run /reload` hint generation -- Phase 4/5 orchestrators using `RELOAD_HINT_PREFIX`
- `agents-index.json` schemaVersion v2 migration -- post-milestone
- Sparse skill copy / hardlink optimization -- not V1
- Deeper MCP entry validation beyond shape -- Pi's runtime concern post-commit
- Agent `dependencies` declaration handling -- Phase 5
