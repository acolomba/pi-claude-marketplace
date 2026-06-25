# Phase 2: Caller-stamped severity & reload reducer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 2-caller-stamped-severity-reload-reducer
**Areas discussed:** Output scope, GATE-01 enforcement, needsReload stamping rule

---

## Output scope (when divergent severities change output)

| Option | Description | Selected |
|--------|-------------|----------|
| Reproduce now, diverge in P3 | P2 reproduces today's output byte-identically; divergent judgments land in Phase 3 with catalog supersession | ✓ |
| Diverge now in P2 | P2 realizes divergent severities + updates catalog-uat fixtures in lockstep | |
| You decide | defer to planner | |

**User's choice:** Reproduce now, diverge in P3
**Notes:** Keeps catalog-uat never-red; cleanest separation — Phase 3 owns all
output changes + fixture rewrites atomically. SEV-05 capability established
structurally here, exercised in Phase 3.

---

## GATE-01 enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Type-level required on transitions | severity+needsReload required on transition message types (omission = compile error); architecture test as thin backstop | ✓ |
| Architecture test only | fields stay optional; runtime/AST test asserts stamping | |
| Both | required fields + architecture test for dynamic cases | (effectively chosen — type-level primary + test backstop) |

**User's choice:** Type-level required on transitions
**Notes:** Matches the Phase 1 "can't be forgotten" compile-time-contract bar.
Non-transition (list/info) rows keep the fields optional. A thin architecture-test
backstop remains for projected/dynamic rows (reconcile-applied) the type system
can't reach — so the realized shape is type-level-primary + test-backstop.

---

## needsReload stamping rule

| Option | Description | Selected |
|--------|-------------|----------|
| Only successful transitions = true | install/uninstall/update/reinstall/enable/disable success → true; failed/skipped/manual-recovery/list/info → false | ✓ |
| You decide | defer to planner | |

**User's choice:** Only successful transitions = true
**Notes (user's words):** "and of course if any of needsReload in a cascade is
true, output the message" — confirms the RLD-02 OR-reduce trailer rule. Reproduces
today's reload-hint trigger set exactly.

---

## Claude's Discretion

- Exact TS shape for narrowing the two base fields to required on transition
  interfaces.
- Architecture-test mechanism for the dynamic/projected-row backstop.
- How each skip-emitting site determines benign-vs-actionable to reproduce today's
  severity (replacing the deleted BENIGN_REASONS lookup); catalog-uat byte gate
  catches drift.

## Deferred Ideas

- Divergent desired-state severities (output-changing) → Phase 3 with catalog supersession.
- Catalog `present`→`installed` grammar collapse + fixture rewrites → Phase 3 / OUT-08.
- Summary surface redesign → Phase 3.
