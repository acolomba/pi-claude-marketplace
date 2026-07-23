# Phase 1: Localized type model & command-context spine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 1-localized-type-model-command-context-spine
**Areas discussed:** Co-location mechanism, Migration breadth, Cardinality, Caller-intent fields, Architecture pivot (registry → CommandContext)

---

## Migration breadth

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate all 18 now | Full cutover this phase | ✓ |
| Spine + subset, rest later | Lower risk per step, partial migration | |
| Spine only this phase | Build anchors, grammar stays central | |

**User's choice:** Migrate all 18 now
**Notes:** Clean cutover; monolith never left half-migrated across a phase boundary.

---

## Cardinality (OUT-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Discriminated cardinality field | `cardinality: 'single' \| 'plural'` discriminant | |
| Tuple-vs-array typing | single = `[Row]`, plural = `Row[]` | ✓ |
| Separate single/plural kinds | distinct envelope kinds | |

**User's choice:** Tuple-vs-array typing
**Notes:** Type system enforces cardinality directly.

---

## Caller-intent fields (severity / needsReload)

| Option | Description | Selected |
|--------|-------------|----------|
| Optional, not yet reduced | optional fields ignored by P1 reducer | ✓ |
| Required with defaults now | front-loads P2 producer work | |
| You decide | defer to planner | |

**User's choice:** Optional, not yet reduced (later refined: these are universal
base-message fields, not per-command). Exact typing introduction → planner's
discretion.
**Notes:** Output stays byte-identical; Phase 2 turns the reduction on.

---

## Co-location mechanism / Architecture pivot (the big one)

Initial framing offered three "grammar contribution" enforcement shapes
(`defineCommandGrammar()` builder / `satisfies` const / class implements), each
with worked TypeScript examples. The user rejected the central-registry premise
underneath all three.

| Option (as offered) | Description | Selected |
|--------|-------------|----------|
| `defineCommandGrammar()` builder | central registry + generic builder + central `Record<Status,RenderFn>` | |
| `satisfies CommandGrammar` const | central registry + hand-written drift proofs | |
| class implements CommandGrammar | central registry + class members | |

**User's choice:** None of the above — reframed the architecture:
- Statuses are command-internal; no central check that they match.
- Reasons: shared ones as topic-grouped enums; command-specific ones stay local.
- `severity`/`needsReload`/`dependencies` are universal base-message fields, not
  per-command grammar.
- `label` stays with the command (horizontal concept) via a `Messaging` member.
- Each command exposes a `CommandContext` class + a const with a `Messaging`
  member carrying the label; the context is passed to `notify()`. "Forget the
  registry." Names must be common across all commands.

**Follow-up resolved:**
- *Requirement text handling* → **Rewrite MOD-02/03 to intent** (command-local
  ownership; drift & missing-arm caught locally; bidirectional proofs deleted).
  REQUIREMENTS.md + ROADMAP.md Phase 1 edited accordingly.
- *Rendering location* (no registry, command-internal statuses) → **Command-local
  render map** over each command's own statuses, calling shared `notify`
  vocabulary helpers. Local exhaustiveness = MOD-03 intent relocated.

---

## Claude's Discretion

- Exact typing mechanism for the optional `severity`/`needsReload` introduction
  (output-neutral constraint).
- `CommandContext` as literal `class` vs interface + const factory — keep the
  `Messaging.label` + render-map contract and the shared naming convention.
- Topic-group taxonomy for shared reasons, derived from the existing `REASONS` set.
- Internal file layout for command-local declarations (sibling module vs.
  co-located in orchestrator) — must stay per-command, idiomatic, additive.

## Deferred Ideas

- Reducer behavior, content-ladder deletions, `present`→`installed`,
  `disable-cascade` removal, GATE-01 → Phase 2.
- Summary surface redesign + atomic catalog supersession → Phase 3.
- Concern-module extraction + ≤3-files open-closed proof → Phase 4.
