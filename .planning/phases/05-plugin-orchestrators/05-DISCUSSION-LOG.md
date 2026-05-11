# Phase 5: Plugin Orchestrators - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 5-Plugin Orchestrators
**Areas discussed:** Install ledger shape & PI-14 exclusion, Update 3-phase atomic swap (PUP-6, AS-3), Cross-bridge name guard (PI-6) placement, list rendering + COMP-01 fix locations

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Install ledger shape & PI-14 exclusion | How does install.ts compose the literal-array Phase<C>[]? Where is PI-14 PathContainmentError-NEVER-folded-into-rollback-partial enforced? | ✓ |
| Update 3-phase atomic swap (PUP-6, AS-3) | Composition pattern for prepare-tmp → state-guard swap → physical replace + soft-dep; recovery hint wording; phase-3a/3b aggregation. | ✓ |
| Cross-bridge name guard (PI-6) placement | Single pre-flight in install.ts vs distributed across bridges. | ✓ |
| list rendering + COMP-01 fix locations | Top-level list renderer location + column-66 truncation helper placement; COMP-01 / Gap 3 supplement-not-replace fix module. | ✓ |

**User's choice:** All four selected.

---

## Install ledger shape & PI-14 exclusion

### Q1 -- Install ledger composition

| Option | Description | Selected |
|--------|-------------|----------|
| 5-phase -- skills, commands, agents, mcp, state (Recommended) | One Phase<C> per bridge plus terminal state-commit. Matches Phase 3 D-02 documented intent verbatim. Cleanest undo isolation. PRD's "skills/prompts" slash read as adjacency. | ✓ |
| 4-phase -- skills+commands collapsed | Skills+commands share resources/ dir; combine into single "resources" phase. Matches PRD literal but loses per-bridge rollback-partial granularity. | |
| 6-phase -- PI-6 guard as phase 0 | Add Phase 0 conflict guard with no undo. Structurally awkward -- ledger phases meant to be undoable. | |

**User's choice:** 5-phase ledger.
**Notes:** Per Phase 3 D-02 documented intent. Bridge-as-Phase mapping; terminal state-commit phase has noop undo.

### Q2 -- PI-14 PathContainmentError exclusion layer

| Option | Description | Selected |
|--------|-------------|----------|
| formatRollbackError detects + bypasses (Recommended) | Phase 2 D-03 single-chokepoint principle. instanceof check, return original error, suppress (rollback partial:) wrapping. | ✓ |
| Orchestrator catch block instanceof guard | Each mutating orchestrator does its own check. Risks drift if a future orchestrator forgets. | |
| runPhases short-circuits at source | Phase ledger primitive becomes domain-aware (knows about specific error subclass). Breaks transaction/ generic contract. | |

**User's choice:** formatRollbackError detects + bypasses.
**Notes:** Extends Phase 2 D-03's "single chokepoint for the user-visible marker string" with one new instanceof case. All mutating orchestrators get PI-14 compliance for free.

---

## Update 3-phase atomic swap (PUP-6, AS-3)

### Q1 -- Composition pattern for the three phases

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-rolled try/catch sequence (Recommended) | Three explicit steps; matches Phase 4 D-02 precedent for heterogeneous-undo flows. State-guard swap is the closure body of phase 2. | ✓ |
| runPhases<UpdateCtx> with 3 literal entries | Forces noop undos that obscure semantics; Phase 2 D-03 rollback-partial marker wouldn't fire cleanly. | |
| Nested runPhases (outer 3-phase + inner per-bridge) | Doubles rollback-partial paths; Phase 2 D-02 didn't define nested-guard semantics. | |

**User's choice:** Hand-rolled try/catch sequence.
**Notes:** Phase-3a (replace) failures aggregate before phase-3b (soft-dep commit) -- continue across bridge failures rather than fail-fast.

### Q2 -- Recovery hint storage location

| Option | Description | Selected |
|--------|-------------|----------|
| Add to shared/markers.ts as prefix-marker (Recommended) | New RECOVERY_PLUGIN_REINSTALL_PREFIX; markers-snapshot test asserts prefix-equivalence against PRD §5.2.3 PUP-6. Treats PUP-6 hint as stable user contract on par with ES-5. | ✓ |
| Keep inline in update.ts | Matches Phase 4 D-14 / MU-5 precedent. PRD §6.12 ES-5 doesn't enumerate this string. Drift risk. | |
| Add as full literal (no prefix-equivalence) | Less flexible than prefix-equivalence; loses Phase 1 B-4 caller-appends-parameter-context pattern. | |

**User's choice:** Add to shared/markers.ts as prefix-marker.
**Notes:** New marker is an extension beyond ES-5; documented as such in the const's JSDoc. Single new markers-snapshot.test.ts case asserts PRD §5.2.3 PUP-6 byte-for-byte.

---

## Cross-bridge name guard (PI-6) placement

### Q1 -- Helper location and API shape

| Option | Description | Selected |
|--------|-------------|----------|
| orchestrators/plugin/shared.ts (Recommended) | Mirror Phase 4 D-01 pattern. assertNoCrossPluginConflicts pure function called by install + update BEFORE bridge.prepare. Reads state from this scope only (Phase 2 D-10). MCP excluded per PRD §6.5. | ✓ |
| domain/cross-bridge-conflict.ts (Phase 3 deferred suggestion) | domain/ layer doesn't conventionally import from persistence/; reading state is orchestrator-shaped. | |
| Distributed: each bridge.prepare emits names; orchestrator aggregates | Breaks Phase 3 D-01 bridge contracts (opaque handles). "BEFORE any disk write" already conflicts with bridge prepare's tmp staging. | |

**User's choice:** orchestrators/plugin/shared.ts.
**Notes:** Throws CrossPluginConflictError with one message listing every conflicting name in deterministic order (skills → commands → agents; alphabetical within kind). RN-4 cross-marketplace agent ownership stays bridge-enforced (complementary layer).

---

## list rendering + COMP-01 fix locations

### Q1 -- Top-level list rendering location

| Option | Description | Selected |
|--------|-------------|----------|
| Match Phase 4: orchestrator + presentation/, helper local (Recommended) | orchestrators/plugin/list.ts handles state + filters + manifest reads; presentation/plugin-list.ts pure renderer; column-66 truncation private inside renderer. Mirrors Phase 4 marketplace-list pattern. | ✓ |
| Single orchestrators/plugin/list.ts file | Violates Phase 4 split; harder to unit-test renderer. | |
| Promote truncation helper to presentation/text-utils.ts now | YAGNI -- promote later when third consumer emerges. | |

**User's choice:** Match Phase 4 (orchestrator + presentation/, helper local).
**Notes:** Truncation helper stays private inside presentation/plugin-list.ts until a third consumer needs it.

### Q2 -- COMP-01 fix location

| Option | Description | Selected |
|--------|-------------|----------|
| Resolver: arrays + supersede PR-4 (Recommended) | Change ComponentPathsSchema from optional-string to readonly-string-array; strict resolver Step 7 unions declared + implicit; loose resolver stays entry-only. Supersede PR-4 verbatim (mirrors D-21 / D-23 pattern). | ✓ |
| Bridge discover unions declared + implicit | Keeps resolver unchanged; bridges silently bypass PR-4. Semantically muddy -- drift risk. | |
| Parallel field: declared + implicitDefaults | Two fields where one would do; consumers must remember to union both. | |

**User's choice:** Resolver: arrays + supersede PR-4.
**Notes:** REQUIREMENTS.md PR-4 strikethrough + PROJECT.md Key Decisions row + CHANGELOG entry "behavior corrected vs. V1: custom component-path arrays now SUPPLEMENT defaults rather than replace them (COMP-01 / Gap 3)". Each of skills/commands/agents discover.ts iterates over the array.

---

## Claude's Discretion

The user signed off on every recommended option presented. All decisions are Claude's calls (within the area framing the user selected) -- captured in CONTEXT.md `<decisions>` so downstream agents (researcher, planner, executor) know the rationale and escalation paths.

- D-01 (5-phase ledger) -- Recommended; user chose.
- D-02 (formatRollbackError owns PI-14 bypass) -- Recommended; user chose.
- D-03 (hand-rolled update sequence) -- Recommended; user chose.
- D-04 (recovery hint as markers.ts prefix) -- Recommended; user chose.
- D-05 (PI-6 guard in orchestrators/plugin/shared.ts) -- Recommended; user chose.
- D-06 (orchestrator+presentation split, truncation private) -- Recommended; user chose.
- D-07 (resolver arrays + PR-4 supersession) -- Recommended; user chose.

## Deferred Ideas

Ideas mentioned or implied during discussion that belong in other phases or post-V1 milestones:

- `info` subcommand (INFO-01 / PRD §11) -- strongest post-V1 candidate
- `--force` install / update flags -- PRD §11 deferral
- JSON output / dry-run modes -- PRD §11 deferral; Phase 6 edge layer can render Phase 5's structured returns
- Manifest-mtime caching (NFR-8 / PERF-01) -- backlog
- Session-start autoupdate run -- PRD §11 / Claude Code parity
- Rich interactive selectors for cross-scope ambiguity -- PRD §11
- Parallel update cascade -- perf optimization deferred until measured
- Telemetry / event channels -- IL-4 forbids V1
- Hardlink-based skill copy -- PRD §11 / Phase 3 deferred
- Companion-extension registration UI -- out of scope; Phase 5 emits canonical soft-dep warning strings only
- PRD v2 §6.4 PR-4 text rewrite -- deferred (supersession lives in `.planning/` artifacts per D-21/D-23 pattern)
- Cross-scope shadowing warning -- Phase 2 D-10 rejected; future `--strict-isolation` flag
