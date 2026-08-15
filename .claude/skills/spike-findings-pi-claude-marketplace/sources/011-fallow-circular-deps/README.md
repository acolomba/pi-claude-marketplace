---
spike: 011
name: fallow-circular-deps
type: standard
validates: "Given `import-x/no-cycle` (orchestrators-only) and the accepted `bridges/hooks/` cycle knot, when `npx fallow` checks the whole graph, then determine coverage beyond the narrower existing rule and whether the known knot can be accepted"
verdict: VALIDATED
related: [010]
tags: [fallow, static-analysis, circular-deps, tooling]
---

# Spike 011: Fallow Circular-Dependency Detection

## What This Validates

`import-x/no-cycle` in this repo's ESLint config is deliberately scoped to
`orchestrators/**` only (`ARCHITECTURE.md` documents a known,
already-accepted cycle knot in `bridges/hooks/` as the reason). Does
Fallow's whole-graph circular-dependency detection catch anything that
narrower rule structurally can't -- and does it agree with the documented,
accepted knot rather than treating it as new noise?

## Research

Reused the `.fallowrc.json` (`entry` + `production: true`) authored and
validated in Spike 010. `dead-code --circular-deps` and
`--re-export-cycles` are the relevant sub-analyses (see `fallow dead-code
--help`, captured in Spike 010's research).

## How to Run

```bash
CFG=.planning/spikes/010-fallow-dead-code-signal/fallowrc-explicit-entry.json
npx --yes fallow dead-code -c "$CFG" --circular-deps --format human
```

## What to Expect

8 circular dependencies, all inside `bridges/hooks/`, identical whether run
zero-config or with Spike 010's explicit-entry config.

## Investigation Trail

**Ran with both zero-config and Spike 010's explicit-entry config:**
identical 8 cycles both times. Unlike dead-code/unused-exports (Spike 010),
circular-dependency detection is a pure import-graph-structure analysis --
it doesn't depend on entry-point resolution at all, so the config quality
issue from Spike 010 doesn't apply here. This rule is trustworthy
regardless of config effort.

**Cross-checked against a root with `node_modules` present** (the
`.worktrees/` linked worktree used for this spike doesn't have its own
`node_modules`, and fallow printed a "for accurate results" warning on
some runs): reran with `--root` pointed at the main checkout. Identical 8
cycles, no warning. Circular-dependency detection doesn't need
`node_modules` for internal-file cycles; the warning applies to
dependency-resolution rules (`unused-deps`, `unresolved-imports`), not this
one. Noted as a methodology caveat for future spikes in this worktree.

**All 8 cycles are confined to one location:**
`dispatch.ts ↔ event-adapters.ts ↔ event-router.ts ↔ settle.ts ↔
async-rewake/registry.ts ↔ dispatch-exec.ts`, entirely inside
`bridges/hooks/`. This is exactly the cycle knot `ARCHITECTURE.md` already
documents by name: "`bridges/hooks/` carries a pre-existing cycle knot
(`event-router.ts` ↔ `dispatch.ts` ↔ `async-rewake/registry.ts`), which is
why the `no-cycle` glob stops at `orchestrators/` rather than covering the
whole extension." Fallow found no cycle anywhere outside this known knot --
in particular, nothing between `orchestrators/plugin/` and
`orchestrators/marketplace/` ledger files, which is the specific
architectural invariant `import-boundaries.test.ts`'s directed-edge grep
gate protects (D-11).

**Re-export cycles:** 0 found, separate sub-analysis, clean.

**Important scope distinction confirmed by reading `ARCHITECTURE.md`
again against this output:** the plugin/marketplace ledger rule D-11
guards against is "must not import each other, in either direction" --
a one-directional ban, not necessarily a cycle. A single one-way import
from `orchestrators/plugin/install.ts` to
`orchestrators/marketplace/add.ts` would violate that rule without forming
a cycle at all. `--circular-deps` cannot express or catch that kind of
one-directional prohibition -- only actual `A → B → ... → A` cycles. That
capability maps to Fallow's boundary/zone configuration instead (Spike
012), not this one.

## Results

**Verdict: VALIDATED.** Fallow's circular-dependency detection is accurate
and config-independent (a real advantage over the entry-point-sensitive
dead-code rules in Spike 010) but on this codebase it found exactly the
single cycle knot already known and already documented -- no new
discoveries, no false positives, no false negatives relative to what a
human already wrote down in `ARCHITECTURE.md`. Its value here is as an
**automated regression guard** for a fact that today is only enforced by
prose plus a narrower, orchestrators-only ESLint rule: if the known knot
ever grows a new file, or a cycle appears anywhere else in the graph,
`fallow dead-code --circular-deps` (or `--ci` in a gate) would catch it
immediately, where today nothing would until someone noticed by hand.

It does **not** cover the one-directional "must not import" ban that is
this project's actual highest-value architecture invariant (D-11) --
that requires boundary/zone config, tested next in Spike 012.
