---
spike: 018
name: hooks-module-state-portability
type: standard
validates: "Given 4 module-level mutable cells in event-router.ts and 17 test files reaching its _*ForTest seams, when that state moves to a leaf module re-exported from event-router.ts, then every seam still observes the same live state and the full check stays green"
verdict: VALIDATED
related: [011, 019]
tags: [hooks, circular-deps, refactor, module-state, esm]
---

# Spike 018: Hooks Module-State Portability

## What This Validates

The `bridges/hooks/` cycle knot (8 cycles, documented in `ARCHITECTURE.md`,
re-confirmed by Spike 011) exists because `event-router.ts` owns both the
shared module state and the orchestration that calls down into
`dispatch.ts` and `settle.ts`. Every proposed cure starts by moving that
state somewhere leaf-ward.

Before comparing cure strategies (Spike 019), this asks the cheaper
question that can kill all of them: **can the state move at all?**
`event-router.ts` holds 4 mutable cells behind 45 in-file references and 6
exported `_*ForTest` seams, and 17 test files reach through those seams.

## Research

None needed. This is ESM module semantics against local code, no external
dependency. The governing fact was known going in and is what the probe
was designed to expose: **imported bindings are read-only**, so a `let`
cell cannot be reassigned by a module that imports it.

## How to Run

Apply the probe (`routing-state.probe.ts` plus `event-router.probe.diff`),
then:

```bash
npm run typecheck
node --test "tests/bridges/hooks/**/*.test.ts"
npm run check
```

## What to Expect

Typecheck clean, 201/201 hooks tests green, full check green, and the
cycle count **unchanged at 8** (this spike deliberately does not break
cycles).

## Investigation Trail

**Mapped the real edge set first, and the first attempt was wrong.** A
single-line grep for `^\s*import .*from "\."` missed multi-line import
blocks, which hid two real edges: `event-router -> settle.ts` (the
specifier sits on line 66, four lines below the `import {`) and
`dispatch -> event-adapters.ts`. Fallow had reported an
`event-router -> settle` edge that the grep did not show, and chasing that
disagreement is what surfaced the bug. Re-extracted with a multi-line-aware
matcher. The corrected graph:

```
dispatch      -> dispatch-exec, event-adapters, event-router
dispatch-exec -> registry, event-router [type-only]
event-adapters-> event-router
event-router  -> registry, dispatch, settle
settle        -> dispatch, event-router
registry      -> event-router
```

Methodology note worth carrying: grep is not an import graph. The same
class of false negative would have been fatal in the dead-code work one
milestone earlier, where a missed importer means deleting live code.

**Classified the cells before touching them,** because the ESM read-only
rule splits them cleanly in two:

| Cell | Kind | Reassigned | Moves how |
|------|------|-----------|-----------|
| `parsedConfigCache` | `const Map` | no | imported and mutated in place |
| `routingTable` | `const Map` | no | imported and mutated in place |
| `liveEpoch` | `let number` | yes (3 sites) | mutators: `bumpEpoch`, `resetEpoch` |
| `pendingSessionStartContext` | `let array` | yes (3 sites) | mutator: `clearPendingSessionStartContext` |

The two `const` Maps cross a module boundary with zero friction: the
binding never changes, only the object's contents. The two `let` cells
cannot cross at all without their reassignment sites converting to
function calls. That is the entire cost of the move, and it is 6 call
sites.

**Built `routing-state.ts` as a true leaf.** It imports only `domain/`,
`shared/`, and `if-field/`. Checked `if-field/` first rather than
assuming: it reaches only `exec-result.ts` and `platform/pi-api.ts`, both
leaves relative to the knot, so importing it introduces no new edge.

**Kept the re-export deliberately.** `event-router.ts` re-exports
`RoutingEntry`, `PendingSessionStartContext`, `currentEpoch`, and
`appendPendingSessionStartContext`, so not one importer and not one test
file changed. That isolates this spike to portability alone and leaves
cycle-breaking entirely to Spike 019. Confirmed by measurement: the cycle
count stayed at exactly 8.

**Typecheck caught the only two defects, both trivial.**
`HookHandlerEntry` and `ParsedMatcher` became unused in `event-router.ts`
once `RoutingEntry` and `CacheEntry` moved out. Nothing else in 999 lines
objected. The failure mode for this refactor is compile-time, not silent,
which is the good outcome: `noUnusedLocals` and the read-only-binding rule
both fail loudly.

**Ran the wider suite, not just the hooks directory.** The 17 seam-touching
test files are not confined to `tests/bridges/hooks/`. They include
`tests/transaction/lifecycle-cascade.test.ts`, four `tests/integration/hooks-*`
files, all four `tests/orchestrators/plugin/{install,uninstall,update,reinstall}.test.ts`,
and `tests/architecture/hooks-exec.test.ts`. A hooks-only run would not
have exercised the plugin-lifecycle paths that reset hook state between
installs, so `npm run check` is the real gate for this refactor, not the
targeted suite.

## Results

**Verdict: VALIDATED.** The state moves. Net effect on `event-router.ts`
is 31 insertions and 88 deletions, the 4 cells and 2 record shapes now
live in a 94-line leaf module, and:

- `npm run typecheck` clean
- 201/201 hooks tests pass
- `npm run check` green end to end (typecheck, lint, fallow, format, unit,
  integration)
- zero test files modified
- cycle count unchanged at 8, as designed

**The finding that matters for Spike 019:** the cost of relocating hooks
module state is 6 mutator call sites, not a redesign. Both cure strategies
now have a validated foundation, and neither is blocked by the test-seam
coupling that looked like the main risk going in.

**What this does not establish.** Portability is not cycle removal. Every
importer still reaches this state through `event-router.ts`, so the graph
is untouched. Whether pointing those importers at the leaf actually breaks
all 8 cycles, and whether the result is more readable than the inversion
alternative, is Spike 019.

One caveat on the re-export trick: it is what makes this spike
non-invasive, but a real adoption should decide whether to keep it. Keeping
it preserves `event-router.ts` as the public face of the hooks bridge;
dropping it forces every consumer to name the leaf directly, which is
noisier at the call site but removes the indirection.
