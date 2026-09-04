---
created: 2026-09-02
resolves_phase: 117
source: 116-CONTEXT discussion
audit_acknowledged:
  milestone: v1.19
  at: 2026-09-04
---

# No gate detects an unused type member

Nothing in the gate stack reports a member of an exported interface that no
call site ever reads. Measured on 2026-09-02 by planting
`readonly neverReadAnywhere?: string` on `EdgeDeps`
(`extensions/pi-claude-marketplace/edge/types.ts`) and running each gate against
the tree with the member in place:

| Gate               | Result with the member planted |
| ------------------ | ------------------------------ |
| `npm run typecheck` | exit 0                        |
| `npm run lint`      | exit 0                        |
| `npm run fallow`    | exit 0, member not mentioned  |

The plant was reverted after the measurement.

## Why each gate misses it

TypeScript has no unused-member check. `noUnusedLocals` covers locals, and
`@typescript-eslint/no-unused-vars` covers variables, neither reaches an
interface member.

`fallow dead-code` reports `unused-type`, `unused-export`, `private-type-leak`,
and `unused-file` — all symbol-or-module granularity. `EdgeDeps` itself is used,
so the type is not dead, and fallow does not descend into which of its members
are read.

Direct coverage cannot see it either, and this is structural rather than a
configuration gap. Coverage answers "did this line run". An unused member has no
read site, so there is no line, and absence of code produces no coverage record.
Coverage finds code that exists and did not run; it is blind to code that was
never written. Type-only modules compound this — they emit no JavaScript at all,
so `scripts/test-coverage-direct.mjs:213` returns `"type-only"` and passes
unconditionally.

A test cannot substitute. A test observes the type's shape from outside;
whether a member is read is a property of the call graph. Testing the consumer
instead just tests the consumer. See the corresponding rule in
`.claude/rules/typescript-unit-testing.md` and the guidelines section it
mirrors — an enumeration test written to close this gap is a proof that cannot
fail, the defect class this milestone exists to remove.

## What is guarded today

- A new **required** member breaks every object literal that builds the type.
  The compiler catches it.
- A new **optional** member that something reads is runtime code in the
  consumer, so the consumer's own owner test drops below 100% direct coverage.
- A member nothing reads is invisible to all of the above.

## Candidate approach

A script in the family of `scripts/check-corresponding-tests.mjs` and
`scripts/test-coverage-direct.mjs`: walk each `PropertySignature` of the
exported interfaces with the TypeScript compiler API, then use the language
service reference search to require at least one read site outside the
declaration. Needs a negative control that plants an unused member and proves
the script fails, per the repository rule that a gate wants a test which plants
the violation.

The only existing instrument that answers "is this member read anywhere" is a
call-graph query such as `codegraph explore`, which is a manual tool rather than
a gate.

## Why deferred

Phase 116 is the edge command surface; this is a repository-wide gate. Phase 117
owns repository-wide gates and already inherits seven correspondence-gate
violations, so the work belongs there. An unused optional member is dead weight
rather than a correctness defect, so it does not block any phase.
