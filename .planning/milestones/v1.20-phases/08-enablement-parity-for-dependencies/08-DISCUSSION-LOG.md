# Phase 8: Enablement parity for dependencies - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-19
**Phase:** 08-Enablement parity for dependencies
**Areas discussed:** Chained disable command, EDEP-03 token, Cascade verbosity

---

## Chained disable command (EDEP-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential command list | Print the literal sequence to run, e.g. `disable Y@mp && disable Z@mp && disable X@mp` — copy-pasteable, dependents first so the final disable of X succeeds. | |
| Plain-English instruction | Name the plugins without inventing shell chaining syntax, e.g. "Disable Y, Z first, then X" — avoids implying a feature (multi-target disable) that doesn't exist. | ✓ |

**User's choice:** Plain-English instruction
**Notes:** The `disable` command only ever takes one plugin target today; a shell-chained command would imply a capability that doesn't exist.

---

## EDEP-03 token (already-installed disabled dependency enabled via record)

| Option | Description | Selected |
|--------|-------------|----------|
| New reason token — `{dependency enabled}` | Parallel to the existing register: `dependency promoted`, `dependency disabled`, `dependency pruned`. Explicit and greppable, but a new closed-set member (full amendment). | ✓ |
| Plain enabled status, no reason | The row's status alone (enabled) already shows the transition; no extra token. Less to pin, but doesn't distinguish this case from an ordinary enable. | |

**User's choice:** New reason token — `{dependency enabled}`
**Notes:** None.

---

## Cascade verbosity (EDEP-01 enable listing)

| Option | Description | Selected |
|--------|-------------|----------|
| Full closure — every dependency gets a row | Matches the install cascade's convention (every member reported, e.g. `{already installed}`); consistent but noisier. | ✓ |
| Only state changes get a row | Quieter — an already-enabled dependency produces no row. Diverges from the install-cascade full-reporting convention. | |

**User's choice:** Full closure — every dependency gets a row
**Notes:** None.

---

## Claude's Discretion

- Exact prose for the plain-English chained-disable instruction (dependent ordering, punctuation) — follow `docs/messaging-style-guide.md`.
- Exact per-row token for an already-enabled dependency under the full-closure report (new token vs. reuse of an existing idempotent-state token).
- Disambiguating the `enable-disable.ts` naming collision between plugin dependencies and the unrelated soft-dep companion extensions (pi-subagents, pi-mcp-adapter).
- Whether the async dependency-satisfaction read reuses `buildScopeDeclarationIndex` directly or a purpose-built sibling.
- Whether a manual `enable <plugin>` clears a stale `dependencyDisabled` consequence-marker at write time, or leaves it for the next reconcile pass to self-correct (both are behaviorally safe per Phase 6's own discretion note).

## Deferred Ideas

- `BACKLOG DEPS-STATUS-01` (a plugin whose dependency is partially installed is itself partial) — stays open, not upstream parity, not pulled into this phase.
- A `list`/`info` marker distinguishing a consequence-disabled plugin from a user-disabled one — out of scope, previously deferred in Phase 6.
