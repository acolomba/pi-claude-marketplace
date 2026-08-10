---
phase: quick-260810-b7w
plan: 01
subsystem: docs
tags: [competitive-analysis, pi-plugins, nklisch, documentation]

status: complete

requires: []
provides:
  - docs/competitive-analysis/pi-plugins.md — structured competitor analysis of
    "@nklisch/pi-plugins" v0.3.5 against pi-claude-marketplace v0.13.0
affects: [docs]

actuals:
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - docs/competitive-analysis/pi-plugins.md
  modified: []

key-decisions:
  - "Pin the competitor snapshot (repo, commit 175142c, v0.3.5) in the document
    header so every claim is scoped to one commit rather than to a moving target."
  - "Keep the three unresolved questions marked UNVERIFIED in-document, each with
    the specific read that would settle it, rather than dropping them or asserting
    them."
  - "Record market-signal figures with their measurement method and shelf life in
    Appendix C, because they carry lower confidence than the source-read findings."
  - "Order the ten recommendations as a table with a bare-integer first column so
    the count survives mdformat, which renumbers ordered lists."

requirements-completed: []

coverage:
  - id: D1
    description: "Document exists at the planned path, pins the competitor snapshot, and carries the planned analytical sections"
    verification:
      - kind: manual
        ref: "grep of headings: 9 H2 analytical sections plus 3 appendices present; header carries commit 175142c, v0.3.5, and analysis date 2026-08-10"
        status: pass
      - kind: manual
        ref: "recommendation table renders exactly 10 numbered rows after mdformat reflow"
        status: pass
  - id: D2
    description: "Formatting gates pass and the document carries no planning-process references"
    verification:
      - kind: manual
        ref: "pre-commit run --files docs/competitive-analysis/pi-plugins.md — clean"
        status: pass
      - kind: manual
        ref: "grep -icE 'gsd|.planning/|milestone v[0-9]|phase [0-9]|wave [0-9]' — 0 hits"
        status: pass
  - id: D3
    description: "Market-signal claims are independently reproduced or corrected before commit"
    verification:
      - kind: manual
        ref: "Local clone + GitHub/npm APIs re-measured on 2026-08-10; downloads, version counts, publish dates, peak days, stars, forks, commit/contributor counts, package list, and the pi-enhanced bundledDependencies claim all reproduced"
        status: pass
      - kind: manual
        ref: "Two figures corrected: open-issue count 1 -> 0; weekly download buckets replaced with reproducible values and explicit bucket boundaries"
        status: pass
    human_judgment: false
---

# Quick Task 260810-b7w — Summary

Added `docs/competitive-analysis/pi-plugins.md`, a structured competitive
analysis of `@nklisch/pi-plugins` (repository `nklisch/pi-extensions`, commit
`175142c7f6029f8676e5d9fcea3037520ff90b86`, v0.3.5) against
`pi-claude-marketplace` v0.13.0. Documentation only. No source, test, package, or
version changes.

Commit: `1d6e4455` — `docs: add pi-plugins competitive analysis`, one file, 854
lines, on branch `features/competitive-analysis-pi-plugins`.

## Substantive findings recorded in the document

The two projects make opposite trades. The competitor supports three component
kinds (Skills, hooks, MCP servers) and installs a plugin whole. We support five
kinds, allow partial installs, and degrade when a soft dependency is absent.
Their slash-command and Claude-agent gaps are structural, not policy: no
`commands/` convention scan exists in their source at the pinned commit.

Their depth is in trust binding, network hardening, plugin user configuration,
and an interactive terminal manager. Ours is in component coverage, hook
fidelity, structurally enforced offline guarantees, and migration away from
Claude Code.

## Divergence from the plan

The delivered section order does not match the order the plan specified. Seven
analytical sections were added beyond the planned outline — competitor overview,
positioning analysis, capability ratings, a strengths/weaknesses/opportunities/
threats block, and strategic implications. Three sit between the executive
summary and the scope section; four sit between the our-limits section and the
borrowable-patterns section.

The plan's section-order verification item was therefore waived rather than
satisfied. The added sections are intentional and were kept. Every other plan
gate was verified against the delivered file after mdformat reflow.

## Executor self-corrections

Two further deviations were self-corrected during execution and needed no
decision.

Four claims that had drifted past the source material were cut: an invented count
of their hook-event mappings, "the widest capability gap in our favor", "the
largest scope item", and an invented cost breakdown for `userConfig`.

A Simplified-English pass split 47 over-length sentences and collapsed two
vocabulary rotations — check/verify/confirm/validate down to `verify`, and
config/settings/options down to `configuration`.

One judgement call is worth knowing: the recommendation table's Size column reads
"Not stated" in six of ten rows, because the research sized only four. A
uniform-looking column would have required inventing the other six.

## Verification note

The added sections rested on GitHub and npm API measurements that were outside
the source material the executor was given, so the executor stopped short of
committing rather than attest to unverified numbers. Every such figure was then
re-measured independently before the commit.

Reproduced exactly: 30-day download totals (5,203 and 2,547), version counts (31
and 35), first-publish dates (2026-07-18 and 2026-05-12), latest version 0.3.5 on
2026-08-08, peak download days, stars (0 and 17), forks (0 and 8), 68 commits
under a single author, the eleven-package monorepo list, and the load-bearing
distribution claim that `@nklisch/pi-plugins` is both a `^0` dependency and a
`bundledDependencies` entry of `@nklisch/pi-enhanced`.

Corrected: our open-issue count was stated as 1 and is 0; the weekly download
figures could not be reproduced under any bucketing and were replaced with
2,074 -> 980 -> 1,001 and 623 -> 651 -> 924, with bucket boundaries named. That
correction changes the trend finding — our downloads rise across all three
buckets rather than dipping and recovering.

One verified detail was added: their first npm publish precedes the first commit
in their public repository, so that history does not cover the full life of the
package. Appendix C records the re-verification and both corrections.

## Follow-ups

- Three claims remain marked UNVERIFIED in the document, each naming the read
  that would settle it: whether we synthesize Claude-style
  `mcp__plugin_x_y__tool` aliases, the contents of their tab-completion
  provider, and whether they expose LLM-callable tools.
- The market-signal figures have a short shelf life. Re-measure before citing.
- The document's prioritized recommendations are analysis, not committed scope.
  Promoting any of them is a separate decision.
