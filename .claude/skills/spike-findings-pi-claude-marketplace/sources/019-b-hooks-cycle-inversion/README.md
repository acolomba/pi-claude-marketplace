---
spike: 019b
name: hooks-cycle-inversion
type: comparison
validates: "Given the 8-cycle bridges/hooks knot, when event-router stops importing dispatch/settle/registry and they register handlers with it instead, then all 8 cycles disappear -- and at what cost relative to 019a"
verdict: LOSES
related: [011, 018, 019a]
tags: [hooks, circular-deps, refactor, comparison, dependency-inversion]
---

# Spike 019b: Cycle Removal by Dependency Inversion

## What This Validates

The mirror image of 019a. Instead of removing the knot's *upward* edges by
lowering the shared state, remove its *downward* edges: `event-router.ts`
stops importing `dispatch.ts`, `settle.ts`, and `async-rewake/registry.ts`
for handler factories, and those modules register their handlers into a
registry the hub reads from.

Both arms answer the same question, so the comparison is decided on cost,
not on whether each one works.

## How to Run

The graph-shape probe (not a working refactor):

```bash
# sever the 3 hub -> importer imports in event-router.ts, then:
./node_modules/.bin/fallow dead-code --circular-deps --format human
```

## What to Expect

Zero cycles on graph terms, matching 019a.

## Investigation Trail

**Measured the graph effect before building the machinery.** Severing the
three hub -> importer import statements in `event-router.ts` and running
the cycle check gave **0 circular dependencies**, the same endpoint as
019a. The derivation holds: with those edges gone, `event-router.ts` has no
outgoing edge inside the knot, and a node with no outgoing edges cannot sit
on a cycle. The remaining edges (`dispatch -> dispatch-exec`,
`dispatch -> event-adapters`, `dispatch-exec -> registry`,
`settle -> dispatch`, and everything pointing at the hub) form no loop.

This probe deliberately does not typecheck. It severs imports whose symbols
are still called, purely to measure graph shape. Reverted immediately;
baseline restored to 8 cycles and confirmed.

So inversion is **not** disqualified on efficacy. It reaches the same zero.

**Then priced the machinery, and this is where it loses.** Eight symbols
cross the hub -> importer boundary: `reapOrphans`,
`shutdownInMemoryChildren` (registry); `compositeHandlerFor`,
`toolResultCompositeHandler` (dispatch); `agentEndCacheHandler`,
`inputResetHandlerFor`, `resetSettleState`, `settleHandlerFor` (settle).
Each needs a typed registry slot.

The blocker is `compositeHandlerFor`, which is generic:

```ts
export function compositeHandlerFor<E extends CompositeDispatchEvent>(
  claudeEvent: E,
  capturedEpoch: number,
  pi?: ExtensionAPI,
): (event: CompositeEventFor<E>, ctx: ExtensionContext) => Promise<CompositeReturnFor<E>>
```

All three of `CompositeDispatchEvent`, `CompositeEventFor<E>`, and
`CompositeReturnFor<E>` are **module-private conditional types declared
inside `dispatch.ts`** -- not exported, deliberately internal. A registry
slot that preserves the generic instantiation needs them, so inversion
requires exporting all three and relocating them to a leaf, or the registry
imports `dispatch.ts` and the edge it was meant to delete comes straight
back.

That is the same leaf-extraction work 019a does, plus widening
`dispatch.ts`'s public type surface, plus eight registration slots, plus a
side-effect import barrel somewhere (`index.ts`) to guarantee the three
modules load and register before the hub reads the registry.

**The regression that decides it.** 019a's failure modes are all
compile-time: a missed symbol or a wrong specifier is a `tsc` error.
Inversion converts a statically checked import into a runtime lookup. If
module load order ever changes so the hub reads a slot before its module
registers, the failure is a runtime throw on a Pi lifecycle event -- the
exact class of failure `index.ts` wraps in defensive try/catch precisely
because a throw there must never escape (NFR-2).

Trading a compile-time guarantee for a load-order-dependent runtime one, to
reach the same zero cycles that five one-line import swaps already reach,
is a bad trade.

## Results

**Verdict: LOSES** (to 019a).

| | 019a leaf extraction | 019b inversion |
|---|---|---|
| Cycles | 8 -> 0 | 8 -> 0 (graph probe) |
| Importer-side change | 5 one-line specifier swaps | 8 registration call sites |
| Hub-side change | state + 1 accessor to a leaf | 8 registry slots + reads |
| New public type surface | none | 3 private conditional types exported |
| Extra machinery | none | registry module + side-effect import barrel |
| Failure mode | compile-time | runtime, load-order dependent |
| Full check | green | not built past the graph probe |

Inversion was not built past the graph probe. Once the generic-type blocker
established that it needs 019a's work *plus* its own, and the runtime
failure mode was identified, further construction would only have measured
how much more expensive an already-losing option is.

Recorded honestly as a limit on this arm's evidence: 019b's zero-cycle
result is a graph measurement, not a working, tested refactor. If someone
later wants inversion for reasons beyond cycles -- decoupling the hub from
handler implementations for testability, say -- this spike does not close
that door. It only shows inversion is the wrong tool for the cycle problem
specifically.
