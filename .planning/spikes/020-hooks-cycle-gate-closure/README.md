---
spike: 020
name: hooks-cycle-gate-closure
type: standard
validates: "Given zero circular dependencies after 019a, when --circular-deps joins the local fallow gate, then the gate still catches boundary violations, newly catches cycles, and npm run check stays green -- closing BACKLOG.md FLOW-02"
verdict: VALIDATED
related: [011, 018, 019a]
tags: [hooks, circular-deps, tooling, gate, fallow]
---

# Spike 020: Closing the Circular-Dependency Gate

## What This Validates

`BACKLOG.md` FLOW-02 records that cycles are gated in CI (through
`fallow audit`'s new-only attribution) but not locally, because
`npm run fallow` passes `--boundary-violations`, which isolates the run to
boundaries. FLOW-02 lists three ways to close that gap and judges the third
-- untangling the knot -- "out of proportion to the gap."

019a made the third option cheap. This spike asks whether the gate can now
actually be closed, and whether closing it costs anything.

## How to Run

With `full-candidate.diff` applied:

```bash
npm run fallow          # combined gate, clean tree
npm run check
```

## What to Expect

Exit 0 on the clean tree, exit 1 with either a cycle or a boundary
violation present, and a green full check.

## Investigation Trail

**The real risk was flag interaction, not the cycles.** `--boundary-violations`
is documented as "Only report boundary violations." Adding `--circular-deps`
could plausibly have overridden it, leaving a gate that looks stricter while
silently enforcing less. A gate that quietly stops checking half its job is
worse than no gate, so both directions were tested rather than assumed.

The flags **union**:

| Tree state | Combined gate |
|---|---|
| 019a applied, clean | exit 0, `No issues found` |
| baseline (8 cycles) | exit 1, `8 circular dependencies` |
| planted cross-bridge import | exit 1, `(bridges-agents -> bridges-mcp)` |

Boundary detection survives the addition, and cycle detection is genuinely
new. Neither result is vacuous.

**One false green along the way.** The first boundary probe ran from the
wrong working directory, so the planted import was never written and fallow
correctly reported `No issues found` on an unmodified tree. Read without
checking, that looks like "the combined gate no longer catches boundary
violations" -- a serious and wrong conclusion. `git status` showed no
modification to `bridges/agents/stage.ts`, which exposed it.

That is the second false result this spike series produced from a probe
that did not exist (019a's mangled regex was the first). Both were caught
the same way: confirming the probe actually changed the tree before
believing what the tool said about it. Worth carrying as a standing habit
rather than a one-off note.

## Follow-up: two config-side findings

Added after the first pass, when the question "does the fallow config need
updating too?" was put directly rather than assumed away. Both findings
came from checking, and the first one corrected a wrong assumption of mine.

**`--re-export-cycles` is a separate flag, and the two-flag gate missed
it.** `fallow dead-code --help` lists `--circular-deps` as "Only report
circular dependencies" and `--re-export-cycles` as "Only report re-export
cycles", and `fallow audit`'s JSON carries `circular_dependencies` and
`re_export_cycles` as distinct counters. The gate as first written closed
the import-cycle gap and left the re-export-cycle gap open, silently. There
are 0 re-export cycles today (Spike 011 measured this), so the third flag
is free now. Re-verified non-vacuity with all three flags: baseline 8
cycles -> exit 1, planted cross-bridge import -> exit 1, clean tree ->
exit 0.

**Rule severity does not gate anything, which I initially assumed it did.**
The first instinct was to raise `rules.re-export-cycle` from its `"warn"`
default to `"error"`. Testing that showed it changes nothing:
`--fail-on-issues` exits 1 on warn-severity findings too. Verified by
running the same analysis under `rules: {"unused-files": "warn"}` and
`{"unused-files": "error"}` against a tree with 4 such findings -- both
exit 1. The flag, not the severity, decides whether the gate sees a
finding at all.

**`.fallowrc.json` itself needs no change for this work.** The
`bridges-hooks` zone pattern already covers `routing-state.ts` on creation,
its imports sit inside that zone's allow list, and
`rules.circular-dependencies` already defaults to `"error"`. The gate lives
in `package.json`.

## Results

**Verdict: VALIDATED.** The gate closes.

```
fallow dead-code --boundary-violations --circular-deps --re-export-cycles --fail-on-issues --format human
```

Runtime cost is nil: the cycle analysis is the same graph walk the boundary
check already performs, and the measured gate time did not move off ~0.3s.

> **Correction (2026-08-15, from the implementation run `cee12150`).** This
> section used to open "`npm run check` green end to end with the combined
> gate and 019a applied." The gate half is right and shipped verbatim -- it
> was additionally confirmed **non-vacuous**, exiting non-zero with
> `8 circular dependencies` against the parent commit. The check half is
> wrong: `full-candidate.diff` swaps module specifiers in place, so it
> leaves 5 `import-x/order` errors and cannot have passed `npm run check`.
> The diff also never creates `routing-state.ts`, so it does not apply as a
> standalone change. See
> `.claude/skills/spike-findings-pi-claude-marketplace/references/hooks-cycle-removal.md`,
> section "Corrections to the spike record."

**Hard sequencing constraint.** This gate change is only safe when 019a
ships with it. Against current `main`, adding `--circular-deps` fails on
the 8 inherited cycles at the first commit. The two changes are one
deliverable, not two -- shipping the gate alone breaks every commit, and
shipping 019a alone leaves the gap FLOW-02 describes.

**What closing this actually buys.** Before: a cycle introduced anywhere in
the extension passes the pre-commit hook, `npm run check`, and every
`ci.yml` run, and surfaces only when a pull request opens (through
`fallow audit`'s new-only attribution). After: it fails at the pre-commit
hook. It also removes the asymmetry FLOW-02 flagged, where a green local
`npm run check` did not imply a green pull-request gate.

**Scope note.** This closes FLOW-02 only. FLOW-01 (files matching no
boundary zone are unchecked and still report clean) is untouched by this
work and remains open.
