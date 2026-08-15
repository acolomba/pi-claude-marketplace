---
spike: 017
name: fallow-ci-overhead
type: standard
validates: "Given the existing pre-commit/CI pipeline, when the full free `npx fallow audit` suite is added as a gate, then measure wall-clock cost and total redundant-vs-novel signal across spikes 010-015"
verdict: VALIDATED
related: [010, 011, 012, 013, 014, 015, 016]
tags: [fallow, static-analysis, ci, tooling]
---

# Spike 017: Fallow CI Overhead and Signal Summary

## What This Validates

The project's `npm run check` pipeline (typecheck + ESLint + Prettier +
tests) runs in roughly 3m11s per the last observed publish-workflow run.
Adding Fallow as a gate is only worth it if the wall-clock cost is small
relative to that, and the earlier spikes' verified findings are worth the
addition. This spike measures the cost and consolidates the
redundant-vs-novel verdict across the whole series.

## Research

`fallow audit --help`: purpose-built for PR gates -- scopes to changed
files, defaults to only failing on findings *introduced* by the changeset
(new-vs-inherited attribution against the merge-base), exits 1 on a fail
verdict. This is the right subcommand for a CI gate, distinct from the
full-repo scans used in Spikes 010-015.

## How to Run

```bash
npx --yes fallow audit --changed-since main --format human   # PR-gate shape
time npx --yes fallow --format human --summary               # full baseline scan
time npx --yes fallow security --format human --summary      # full security scan
```

## What to Expect

Each command completes in 1-3 seconds, warm. `audit` correctly excludes
the 3 known-stale devDependencies (inherited from `main`, not introduced
by this branch) from its pass/fail verdict.

## Investigation Trail

**Timed `fallow audit --changed-since main`** against this branch's real
18-file diff (all `.planning/spikes/*` docs -- no production code touched):
**2.45s total** (`user 2.47s, system 1.59s, 165% cpu` -- multi-threaded).
Verdict: PASS. Correctly reported the 3 stale devDependencies from Spike
010 as "3 inherited findings" excluded from the gate, rather than failing
the PR for a pre-existing issue -- confirms the new-vs-inherited
attribution model works as documented, not just as claimed.

**Timed the full combined scan** (bare `fallow`, dead-code + dupes +
health together, the same analysis Spikes 010/013/014 each ran
individually): **1.21s total.**

**Timed the full security scan** (Spike 015's `fallow security`):
**1.14s total.**

**Compared against the project's own pipeline:** `npm run check` runs
~3m11s (191s) per the last observed CI run (publish workflow,
`.github/workflows/publish.yml`). Every Fallow command measured here is
under 3 seconds -- summing dead-code + dupes + health + security + a
typical `audit` gate comes to roughly 8-10 seconds, under 1% of the
existing pipeline's wall-clock cost. This matches the vendor's own
"27.1x faster than comparable tools" benchmarking claim (Spike 010's
research) -- nothing observed here contradicts it.

**Caveat:** these are warm timings. `npx fallow` downloads and verifies a
platform binary on first use (observed but not stopwatched at the start of
this spike series); a cold CI runner without a persistent cache would pay
that cost once per run unless the binary is cached between jobs (Fallow's
own GitHub Action, referenced in Spike 010's research, handles this).

**Consolidated redundant-vs-novel signal, spikes 010-016:**

| Capability | Verdict | Overlaps existing tooling? | Adoption cost |
|---|---|---|---|
| Dead code (010) | Real, novel signal (whole-file/barrel dead code) | No | Needs hand-authored `entry` config; zero-config is a near no-op |
| Circular deps (011) | Confirms known state, no new findings | Partial (narrower ESLint rule) | Free -- config-independent, safe as a regression guard |
| Boundaries (012) | Matches ESLint at parity, exceeds it at finer granularity | Yes, heavy | Manual allow-based config port; reachability-gated (weaker than ESLint in one direction) |
| Duplication (013) | Real, novel signal (one unlisted 4-file clone) | Yes, heavy | Zero -- works out of the box |
| Complexity/health (014) | Novel signal (cyclomatic, unit-size, MI -- ESLint checks none) | Partial (cognitive complexity only) | Needs a `fallow-ignore` pass mirroring 8 existing ESLint suppressions |
| Security (015) | No novel signal on this codebase | Yes (Sonar hotspots) | N/A -- high false-positive rate here specifically |
| Autofix (016) | Actively unsafe unattended | N/A | Needs a hand-authored `ignoreExports` allowlist before first run |

## Results

**Verdict: VALIDATED.** Wall-clock overhead is not a blocker at any
adoption scale explored here -- full baseline scans, security scans, and
PR-gate `audit` runs all complete in low single-digit seconds, negligible
against the existing ~3-minute pipeline. `audit`'s new-vs-inherited
attribution is real and correctly demonstrated on this branch's own diff,
which matters for the practical question of whether adding this as a
required PR check would create false-fail noise on unrelated pre-existing
findings -- it wouldn't.

The overall adoption picture, combining all 7 spikes: performance is a
non-issue; the blocking work is entirely upfront configuration and
convention-teaching (an `entry` field, a boundary config, an
`ignoreExports` allowlist for test seams) that this project's specific
conventions (`_*ForTest`, `__test_*`, `production: true` semantics) make
non-trivial to get right before any gate or autofix step can be trusted
unattended.
