# Hooks Circular-Dependency Removal

Implementation blueprint for removing the 8-cycle `bridges/hooks/` knot and
closing the local circular-dependency gate. Nothing has landed in
`extensions/` yet: the spikes reverted their source changes and left an
appliable diff behind.

**Status: proven, not shipped.** `sources/020-hooks-cycle-gate-closure/full-candidate.diff`
applies cleanly against the post-fallow-adoption tree and carries the whole
change.

## Requirements

- The cure is **leaf extraction of shared state**, not dependency
  inversion. Both reach zero cycles; inversion costs strictly more and
  regresses the failure mode from compile-time to runtime.
- Any module-state relocation MUST convert every reassignment site to a
  named mutator. ESM imported bindings are read-only, so a `let` cell
  cannot move unless its writes move with it.
- The leaf owns the state **and its pure accessors**. Leaving a one-line
  reader behind in the hub re-creates the edge the move was meant to
  delete.
- `--circular-deps` may only join the local gate in the same change that
  removes the cycles. Added alone it fails on the 8 inherited cycles at the
  first commit.
- `bridges/hooks/` is outside the `import-x/no-cycle` ESLint glob (which
  stops at `orchestrators/`) precisely because of this knot. If the knot
  goes, revisit whether that glob should widen.

## How to Build It

### 1. Map the real import graph -- do not trust grep

The knot is 6 files. Their edges, verified against fallow's graph:

```
dispatch      -> dispatch-exec, event-adapters, event-router
dispatch-exec -> registry, event-router [type-only]
event-adapters-> event-router
event-router  -> registry, dispatch, settle
settle        -> dispatch, event-router
registry      -> event-router
```

A single-line `grep '^import .* from'` **misses multi-line import blocks**
and hid two of these edges (`event-router -> settle`, whose specifier sits
four lines below the `import {`, and `dispatch -> event-adapters`). A
multi-line regex over `import\s*\{[\s\S]*?\}\s*from` over-matches in the
other direction and silently mangles adjacent blocks. Extract with a
specifier-level matcher, then cross-check against
`fallow dead-code --circular-deps`.

### 2. Create the leaf module

`bridges/hooks/routing-state.ts`, importing only `domain/`, `shared/`, and
`if-field/` (confirmed leaf-ward: it reaches only `exec-result.ts` and
`platform/pi-api.ts`). It holds:

- `RoutingEntry`, `CacheEntry`, `PendingSessionStartContext` (record shapes)
- `parsedConfigCache`, `routingTable` (`const` Maps, exported directly)
- `liveEpoch`, `pendingSessionStartContext` (`let` cells, private)
- accessors: `currentEpoch`, `bumpEpoch`, `resetEpoch`,
  `appendPendingSessionStartContext`, `pendingSessionStartContextEntries`,
  `clearPendingSessionStartContext`, `getRoutingBucket`

The `const`/`let` split is the whole mechanical cost. The Maps cross a
module boundary untouched because the binding never changes, only the
contents. The two `let` cells have 6 reassignment sites in
`event-router.ts` that become mutator calls:

| Site | Becomes |
|------|---------|
| `liveEpoch += 1; const captured = liveEpoch;` | `const captured = bumpEpoch();` |
| `liveEpoch = 0;` (in `_resetForTest`) | `resetEpoch();` |
| `liveEpoch += 1; return liveEpoch;` (`_bumpEpochForTest`) | `return bumpEpoch();` |
| `pendingSessionStartContext = [];` (x3) | `clearPendingSessionStartContext();` |

Full working module: `sources/019-a-hooks-cycle-leaf-extraction/routing-state.ts`.

### 3. Repoint the five importers

This is the entire cycle-breaking change on the consumer side. Five
one-line module-specifier swaps, no symbol changes:

```ts
// dispatch.ts
import { currentEpoch, getRoutingBucket, type RoutingEntry } from "./routing-state.ts";
// dispatch-exec.ts
import type { RoutingEntry } from "./routing-state.ts";
// event-adapters.ts
import { appendPendingSessionStartContext } from "./routing-state.ts";
// settle.ts
import { currentEpoch, getRoutingBucket } from "./routing-state.ts";
// async-rewake/registry.ts
import { currentEpoch, type RoutingEntry } from "../routing-state.ts";
```

`event-router.ts` keeps importing `dispatch`, `settle`, and `registry` for
handler factories. Those edges are real and stay; they are simply
one-directional now, and a one-directional edge cannot cycle.

### 4. Decide the re-export question

Spike 018 kept `event-router.ts` re-exporting the moved names, which is
what let it validate portability without touching a single importer or
test. 019a dropped the re-export. Either ships:

- **Keep it:** `event-router.ts` stays the public face of the hooks bridge;
  consumers outside the knot need no change.
- **Drop it:** every consumer names the leaf directly. Noisier at call
  sites, no indirection.

019a's measured diff (6 files, +38/-96) is the drop-it version.

### 5. Close the gate in the same change

```
fallow dead-code --boundary-violations --circular-deps --re-export-cycles --fail-on-issues --format human
```

The flags **union** rather than override, verified in all directions: a
planted cross-bridge import fails (`bridges-agents -> bridges-mcp`), the
baseline's 8 cycles fail, and the clean tree exits 0. This closes
`BACKLOG.md` FLOW-02 and removes the asymmetry where a green local
`npm run check` did not imply a green pull-request gate.

`--re-export-cycles` is a **separate isolating flag** from
`--circular-deps` -- `fallow dead-code --help` describes them as "Only
report circular dependencies" and "Only report re-export cycles"
respectively, and `fallow audit`'s JSON reports `circular_dependencies` and
`re_export_cycles` as distinct counters. A two-flag gate closes the
import-cycle gap and silently leaves the re-export-cycle gap open. There
are 0 re-export cycles today (Spike 011), so adding the third flag is free
at adoption time and only gets more expensive later.

### 6. What `.fallowrc.json` needs: nothing

Checked rather than assumed, because "close the cycle gate" sounds like a
config change and is not:

- **Zones already cover the new leaf.** `bridges-hooks` is
  `extensions/pi-claude-marketplace/bridges/hooks/**`, so
  `routing-state.ts` is zoned on creation, and its imports (`domain/`,
  `shared/`, and same-zone `if-field/`) all sit inside the zone's
  `allow: ["domain", "persistence", "shared", "platform"]`. No zone or rule
  edit.
- **`rules.circular-dependencies` already defaults to `"error"`.** Nothing
  to raise.
- **Rule severity does not gate anything.** `--fail-on-issues` exits 1 on
  **warn-severity findings too**, verified by running the same analysis
  under `rules: {"unused-files": "warn"}` and `"error"` against a tree with
  4 such findings -- both exit 1. So raising
  `rules.re-export-cycle` from its `"warn"` default to `"error"` would be
  cosmetic; the flag, not the severity, is what makes the gate see the
  finding at all. This is the trap worth remembering: severity looks like
  the lever and isn't.

The gate lives entirely in `package.json`'s `fallow` script.
`.fallowrc.json` governs *what fallow analyses see*; the CLI flags govern
*which analyses the gate runs*.

## What to Avoid

- **Do not reach for dependency inversion.** It works (0 cycles, confirmed
  by a graph-shape probe) but `compositeHandlerFor` is generic over
  `CompositeDispatchEvent`, `CompositeEventFor<E>`, and
  `CompositeReturnFor<E>` -- three conditional types that are
  **module-private to `dispatch.ts`**. A typed registry slot needs all
  three exported and relocated to a leaf, which is 019a's work plus an
  8-slot registry plus a side-effect import barrel in `index.ts` to
  guarantee registration order. It also converts a statically checked
  import into a runtime lookup that can throw on a Pi lifecycle event,
  which is the class of failure `index.ts` wraps in defensive try/catch
  precisely because a throw there must never escape (NFR-2).
- **Do not add `--circular-deps` to the gate on its own.** It fails on the
  8 inherited cycles immediately.
- **Do not trust a probe result without confirming the probe landed.** This
  series produced two false results from probes that never modified the
  tree: a mangled regex that left imports in place and reported "8 cycles,
  unchanged" (reads as a clean architectural finding), and a boundary probe
  run from the wrong working directory that reported "No issues found"
  (reads as a broken gate). Neither surfaced as a failing command. Check
  `git status` or `git diff --stat` before recording any probe result.

## Constraints

- 17 test files reach `event-router.ts`'s `_*ForTest` seams, and they are
  **not** confined to `tests/bridges/hooks/`. They include
  `tests/transaction/lifecycle-cascade.test.ts`, four
  `tests/integration/hooks-*` files, all four
  `tests/orchestrators/plugin/{install,uninstall,update,reinstall}.test.ts`,
  and `tests/architecture/hooks-exec.test.ts`. `npm run check` is the real
  gate for this refactor; the hooks-only suite is not sufficient.
- `event-router.ts` is 999 lines and holds 45 in-file references to the 4
  state cells. The move touched all of them and typecheck caught the only
  two defects (two orphaned type imports), so the refactor's failure mode
  is compile-time throughout.
- Measured result: cycles 8 -> 0, `npm run check` green, zero test files
  modified, total diff 7 files / +39 / -97 including the gate flag.
- `ARCHITECTURE.md` documents the knot by name and cites it as the reason
  `import-x/no-cycle` stops at `orchestrators/`. Removing the knot makes
  that passage stale -- update it in the same change.

## Origin

Synthesized from spikes: 018, 019a, 019b, 020
Source files available in: `sources/018-hooks-module-state-portability/`,
`sources/019-a-hooks-cycle-leaf-extraction/`,
`sources/019-b-hooks-cycle-inversion/`,
`sources/020-hooks-cycle-gate-closure/`
