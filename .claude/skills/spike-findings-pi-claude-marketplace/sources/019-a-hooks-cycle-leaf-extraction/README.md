---
spike: 019a
name: hooks-cycle-leaf-extraction
type: comparison
validates: "Given the 8-cycle bridges/hooks knot, when shared state and RoutingEntry move to a leaf module and the five importers point at it instead of the hub, then all 8 cycles disappear and the full check stays green"
verdict: WINNER
related: [011, 018, 019b]
tags: [hooks, circular-deps, refactor, comparison]
---

# Spike 019a: Cycle Removal by Leaf Extraction

## What This Validates

The knot's upward edges exist because five files reach into
`event-router.ts` for shared state and one record type. This arm asks
whether relocating that shared surface to a leaf module, so the edges point
down instead of up, is enough to break all 8 cycles.

Builds directly on Spike 018, which proved the state can move at all. This
arm adds the second half: repointing the importers and dropping the
re-export.

## How to Run

Apply `leaf-extraction.diff` (includes `routing-state.ts`), then:

```bash
npm run typecheck
./node_modules/.bin/fallow dead-code --circular-deps --format human
npm run check
```

## What to Expect

Zero circular dependencies, down from 8. Full check green.

> **Correction (2026-08-15, from the implementation run `cee12150`).** The
> cycle result held exactly as recorded: 8 -> 0, zero test files touched.
> The "full check green" half did not. `leaf-extraction.diff` swaps each
> module specifier in place, and `routing-state` sorts *after* the
> `event-router` it replaces, so the captured tree carries 5
> `import-x/order` errors and `npm run check` could not have passed on it.
> `npx eslint --fix` on the five importers settles it. See
> `.claude/skills/spike-findings-pi-claude-marketplace/references/hooks-cycle-removal.md`,
> section "Corrections to the spike record."

## Investigation Trail

**First measurement was wrong, and nearly became a finding.** The initial
repoint used a regex over `import\s+(type\s+)?\{([\s\S]*?)\}\s*from ...`
to split each importer's hub import into a leaf half and a residual half.
The non-greedy body matched past the intended closing brace on adjacent
import blocks, so the rewrite left residual `event-router` imports in place
*and* duplicated names into the new leaf import. Measurement said **8
cycles, unchanged**, which reads as a clean, quotable result: "leaf
extraction is necessary but not sufficient."

It was an artifact. The tell was internal inconsistency rather than a
failing command: the reported cycles still ran through `dispatch`,
`settle`, and `registry`, which were exactly the edges just supposedly
removed. Grepping for which files still *named* `event-router.ts` showed
mangled import blocks, not an architectural constraint.

Reverting the five importers and re-reading their baseline imports showed
how little was actually there:

```
dispatch.ts       import { currentEpoch, getRoutingBucket, type RoutingEntry } from "./event-router.ts";
dispatch-exec.ts  import type { RoutingEntry } from "./event-router.ts";
event-adapters.ts import { appendPendingSessionStartContext } from "./event-router.ts";
settle.ts         import { currentEpoch, getRoutingBucket } from "./event-router.ts";
registry.ts       import { currentEpoch, type RoutingEntry } from "../event-router.ts";
```

Five single-line imports, every named symbol already living in the leaf.
Five exact string swaps of the module specifier. No structural rewrite at
all.

The recurring lesson across 018 and 019a: **regex is not a parser.** In 018
a single-line grep missed multi-line imports and hid two real edges; here a
multi-line regex mangled single-line ones and invented a false negative.
Both times the disagreement between hand-rolled extraction and fallow's
graph was the signal worth chasing.

**One symbol had to move that Spike 018 did not anticipate.**
`getRoutingBucket` stayed behind in `event-router.ts` after 018 because it
is a function, not a state cell. Typecheck caught it immediately
(`Module './routing-state.ts' has no exported member 'getRoutingBucket'`).
Its body is a one-line read of `routingTable`:

```ts
return routingTable.get(claudeEvent) ?? [];
```

Pure state access with no orchestration, so it belongs with the state it
reads. Moved to the leaf. The general rule this suggests: the leaf should
own the state *and* its pure accessors, not the state alone.

## Results

**Verdict: WINNER.**

- Circular dependencies: **8 -> 0** (confirmed on implementation)
- `npm run typecheck` clean
- ~~`npm run check` green end to end~~ -- **not reproducible**, see the
  Correction above; the captured diff carries 5 `import-x/order` errors
- Zero test files modified (confirmed on implementation)
- Total diff: 6 files, 38 insertions, 96 deletions -- this is the cost of
  the captured *edit*, not of the change; shipping it came to 10 files,
  +318/-193, because the diff does not create `routing-state.ts` and does
  not carry the doc updates

The importer-side cost is five one-line module-specifier swaps. The
hub-side cost is Spike 018's already-validated state move plus relocating
one accessor. Nothing in the refactor touches control flow, handler
registration, or module load order.

**Why it works on graph terms.** The knot had edges in both directions
between the hub and its collaborators. Leaf extraction removes every
*upward* edge (importer -> hub) by giving the importers a lower target.
The remaining hub -> {dispatch, settle, registry} edges are real and
unchanged, but they are now strictly one-directional, and a one-directional
edge cannot form a cycle.

**Failure mode is compile-time**, which matters for the comparison against
019b. Every way this refactor can go wrong -- a missed symbol, a wrong
specifier, an orphaned import -- is a `tsc` error. Nothing about it can
fail only at runtime.
