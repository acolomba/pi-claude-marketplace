# Hooks Circular-Dependency Removal

Implementation blueprint for removing the 8-cycle `bridges/hooks/` knot and
closing the local circular-dependency gate.

**Status: SHIPPED** as part of PR #132 (`features/fallow-full-gate`); the
work landed in the `routing-state.ts` leaf extraction. Cycles
went 8 -> 0, `npm run check` is green, and zero test files were touched. The
sections below are kept as the record of how it was done; the corrections
marked below are the places where the pre-implementation blueprint was wrong
and the shipping run found out.

`sources/020-hooks-cycle-gate-closure/full-candidate.diff` still applies
cleanly (`git apply --check` exits 0), but it does **not** carry the whole
change, and it is **not** lint-clean. Two corrections, both found only by
running the thing:

- **The diff does not create `routing-state.ts`.** It touches the 6 knot
  files plus `package.json`, and all five repointed imports assume
  `./routing-state.ts` already resolves. Apply it first and typecheck fails
  on 5 unresolved specifiers. Create the leaf module first --
  `sources/019-a-hooks-cycle-leaf-extraction/routing-state.ts` is the
  working source.
- **The diff breaks `import-x/order` in all five importers.** It swaps
  module specifiers in place, and `routing-state` sorts *after* the
  `event-router` it replaces (after `exec-result.ts`, `exec-timer.ts` and
  `if-field/index.ts`). ESLint fails with 5 `import-x/order` errors.
  `npx eslint --fix` on those five files settles it -- purely mechanical
  line moves, no specifier or symbol changes. This is why the spike record's
  "npm run check green" claim did not reproduce; see Corrections below.

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
- `bridges/hooks/` used to sit outside the `import-x/no-cycle` ESLint glob
  (which stopped at `orchestrators/`) precisely because of this knot. That
  rule no longer exists: the glob question was reopened once the knot went,
  and the rule was measured reporting NOTHING on a deliberate two-file cycle
  at any glob, including inside `orchestrators/` where it already applied. It
  was deleted rather than widened. The unfiltered `fallow dead-code` run in
  `npm run fallow` is now the repo-wide cycle gate.

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
test. Two shapes are available:

- **Keep it:** `event-router.ts` stays the public face of the hooks bridge;
  consumers outside the knot need no change.
- **Drop it:** every consumer names the leaf directly. Noisier at call
  sites, no indirection.

**Correction.** This section used to claim "019a's measured diff is the
drop-it version." That is wrong, and it matters. `full-candidate.diff`
appends a re-export block to `event-router.ts`:

```ts
export {
  appendPendingSessionStartContext,
  currentEpoch,
  getRoutingBucket,
  type PendingSessionStartContext,
  type RoutingEntry,
};
```

So 019a is a **hybrid, and the hybrid is the point**: only the five
knot-internal importers are repointed, which is what severs the cycles,
while the external surface stays on `event-router.ts`. That is precisely
why zero test files needed editing -- a claim this same document reported
as a measured result while also describing the change as "drop-it," which
is self-contradictory, since drop-it means every consumer names the leaf
directly. Shipped as the hybrid.

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
- **Do not apply the candidate diff and assume the tree is clean.** It
  leaves 5 `import-x/order` errors (see the header) and it strands **eight
  doc-comment blocks** in `event-router.ts` -- it deletes declarations but
  keeps the comments that documented them, including the section banners
  `// Types` and `// Routing-table reader (consumed by dispatch.ts)` that
  end up with nothing under them. Nothing in `npm run check` catches a
  dangling block comment; typecheck, lint and Prettier are all happy with
  a comment describing something that no longer exists. Read the deleted
  hunks and account for every comment they orphan.
- **Do not let the moved fields lose their spec anchors.** The spike's
  `routing-state.ts` has bare interface fields, so moving the state as
  shipped by the spike would destroy the D-60-01 / D-60-04 / MATCH-03 /
  D-61-02 doc anchors that `.claude/rules/typescript-comments.md` calls
  for. Carry the field comments across with the declarations.
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
  state cells. The move touched all of them, and for the *code* the failure
  mode is compile-time throughout -- typecheck caught the only two defects
  (two orphaned type imports).

  The blueprint used to stop there and conclude "compile-time throughout,"
  which is the sentence that made the change feel safer than it was. It is
  true of declarations and false of everything around them: the orphaned
  doc comments, the stranded section banners and the `import-x/order`
  breakage are all invisible to typecheck, and one of the three is
  invisible to the whole of `npm run check`. Compile-time safety covers
  what the compiler models, which is not the same as what a reviewer reads.
- Measured result **as shipped** (the cycle-removal commit inside PR #132):
  cycles 8 -> 0, `npm run check`
  green, zero test files modified, total diff **10 files / +318 / -193**
  including the gate flags.

  The pre-implementation figure recorded here was "7 files / +39 / -97,"
  which counted only the candidate diff. It omitted the 239-line
  `routing-state.ts` the diff never creates, the doc comments carried across
  with the moved declarations, and the `ARCHITECTURE.md` / `BACKLOG.md`
  updates. Treat a spike's diffstat as the cost of the *edit it captured*,
  not the cost of the change.
- The gate was verified **non-vacuous**, not merely green: the identical
  flag set run against the parent commit reports `8 circular dependencies`
  and exits non-zero, while the post-change tree exits 0. A gate that has
  never been seen to fail has not been tested.
- `ARCHITECTURE.md` documented the knot by name and cited it as the reason
  `import-x/no-cycle` stopped at `orchestrators/`. Removing the knot made
  that passage stale -- it was updated in the same change.
  Whether the ESLint glob should widen past `orchestrators/` was left
  open as `BACKLOG.md` FLOW-03. FLOW-03 is now **CLOSED** (2026-08-17,
  in PR #132): the question is moot because the rule is gone. Widening the
  glob was free, but the planted two-file cycle the item's own recipe calls
  for was never reported at any glob, so the rule was deleted.

## Corrections to the spike record

Four claims in the 018/019a/020 record did not survive implementation. They
are listed together because they share one cause, which is the useful part.

| Claim | Where | Reality |
|-------|-------|---------|
| `npm run check` green | 019a README, 020 README, MANIFEST, SKILL.md | The captured diffs leave 5 `import-x/order` errors. A green check was recorded for a tree that could not have been green. |
| "carries the whole change" | this file | The diff never creates `routing-state.ts`; applied alone it fails typecheck on 5 unresolved specifiers. |
| "019a is the drop-it version" | this file, §4 | The diff appends a re-export block. 019a is the hybrid, and the hybrid is why zero tests changed. |
| 7 files / +39 / -97 | this file | 10 files / +318 / -193 as shipped. |

The common cause is that **all four are properties of the captured diff
being read as properties of the change.** A spike's `git diff` records the
edit the spike made; it does not record the file the spike hand-created
before editing, the lint pass it never ran, or the docs a real change has
to carry. Spike 019a genuinely did reach 0 cycles with no test edits -- the
architectural finding is sound and shipped intact. What was unreliable was
every number and gate-status attached to it.

The existing "do not trust a probe result without confirming the probe
landed" entry under What to Avoid caught probes that *never ran*. This is
the adjacent failure: probes that ran, produced a real result, and had a
verification status attached that was never separately established. Record
the command output, not the conclusion you expect from it.

## Origin

Synthesized from spikes: 018, 019a, 019b, 020
Source files available in: `sources/018-hooks-module-state-portability/`,
`sources/019-a-hooks-cycle-leaf-extraction/`,
`sources/019-b-hooks-cycle-inversion/`,
`sources/020-hooks-cycle-gate-closure/`
