---
spike: 012
name: fallow-boundary-fidelity
type: standard
validates: "Given the 9-zone `no-restricted-paths` config plus custom grep-gate architecture tests, when the same rules are expressed in `.fallowrc.json`, then determine match, gap, or noise"
verdict: VALIDATED
related: [010, 011]
tags: [fallow, static-analysis, boundaries, tooling]
---

# Spike 012: Fallow Boundary Fidelity

## What This Validates

This repo enforces its layered architecture
(edge → orchestrators → {bridges, domain, transaction, persistence} →
{platform, shared}) via a hand-written 8-zone `import-x/no-restricted-paths`
ESLint config. Can the same rules be expressed in Fallow's `boundaries`
config, and does doing so match, exceed, or produce noise against what's
already enforced?

## Research

Pulled the exact zone definitions from `eslint.config.js` (BLOCK C, D-11,
lines 176-273) and Fallow's boundary schema from `fallow config-schema`
(`$defs.BoundaryConfig`/`BoundaryZone`/`BoundaryRule`). Key model
difference: ESLint's `no-restricted-paths` is **deny-based**
(`target: X, from: [zones that must NOT import X]`); Fallow's `boundaries`
is **allow-based** (`from: X, allow: [zones X may import]`). Translating
between them means reading each ESLint zone's `message` field (which states
the positive allow-list in prose) rather than inverting the deny-lists by
hand.

## How to Run

```bash
CFG=.planning/spikes/012-fallow-boundary-fidelity/fallowrc-boundaries.json
npx --yes fallow list --boundaries -c "$CFG"
npx --yes fallow dead-code -c "$CFG" --boundary-violations --format human
```

## What to Expect

Zero violations against the real, currently-clean codebase for both the
8-zone (coarse) and 12-zone (fine-grained bridges) configs.

## Investigation Trail

**Authored `fallowrc-boundaries.json`** with 8 zones matching
`eslint.config.js` 1:1 (`edge`, `orchestrators`, `bridges`, `domain`,
`transaction`, `persistence`, `platform`, `shared`), translating each
zone's ESLint `message` field into a Fallow `allow` list. `fallow list
--boundaries` confirmed correct membership (e.g. 59 files in `bridges`, 18
in `domain`) and rules matching the intended allow-lists.

**Ran `--boundary-violations` against the real codebase: zero issues** --
expected, since the codebase already passes its own ESLint gate.

**Verified the config isn't silently permissive** (a clean run alone
doesn't prove the check works) by planting a deliberate violation and
reverting immediately after each check:
- First attempt: a new orphan file
  (`domain/_temp-boundary-violation.ts`) importing from
  `orchestrators/plugin/install.ts`. **Fallow reported zero violations** --
  surprising, until cross-referenced with Spike 010's finding: `--boundary-violations`
  runs as part of `dead-code`'s reachability analysis and only checks the
  subgraph reachable from the configured `entry`. An unreachable file isn't
  boundary-checked at all.
- Second attempt: the same import planted inside `domain/name.ts`, an
  existing, confirmed-reachable file. **Fallow correctly reported it**:
  `domain/name.ts:4 → orchestrators/plugin/install.ts (domain →
  orchestrators)`, then reverted with `git checkout --`.

  This is a real fidelity gap versus ESLint: `no-restricted-paths` lints
  every file matching its glob regardless of whether anything imports it;
  Fallow's boundary check only examines the reachable graph. A boundary
  violation sitting in dead code would be invisible to Fallow but caught by
  ESLint.

**Tested the "Cross-bridge imports are also forbidden" claim** --
`eslint.config.js`'s `bridges` zone `message` field states this, but the
zone's actual `from` list (`[edge, orchestrators, transaction]`) only
restricts those three zones from importing bridges/ -- it says nothing
about `bridges/agents/` importing `bridges/mcp/`. Modeled this as its own
question:
- **Coarse config (single `bridges` zone):** planted
  `bridges/agents/stage.ts` importing from `bridges/mcp/index.ts`.
  Fallow reported **zero violations** -- same-zone imports are always
  implicitly allowed, and both bridge kinds are one zone in this config.
- **Fine-grained config** (`fallowrc-boundaries-finegrained.json`, 12
  zones -- one per bridge kind instead of one `bridges` zone): same
  planted violation. Fallow **correctly caught it**:
  `bridges/agents/stage.ts:4 → bridges/mcp/index.ts (bridges-agents →
  bridges-mcp)`.
- **Cross-checked against the real ESLint config and the test suite**:
  `npx eslint` on the same probe file reported only an unrelated
  `import-x/order` warning -- **no boundary violation at all**. Grepped
  `tests/` for "cross-bridge": the only hits
  (`integration-materialization-gate.test.ts`) test a different concept
  (D-01 runtime staging isolation between bridges, not the static import
  graph). **Nothing in this codebase's actual enforced ruleset checks
  "cross-bridge imports forbidden" today** -- it exists only as prose in an
  ESLint message string attached to an unrelated rule. This is a genuine,
  previously-unknown doc/enforcement drift: the fine-grained Fallow config
  closes a real gap, not an imagined one.

## Results

**Verdict: VALIDATED.** With careful, hand-translated config (allow-based,
not deny-based -- a real authoring cost, not a drop-in port), Fallow's
boundary/zone system matches this project's ESLint enforcement exactly at
the 8-zone granularity, and a fine-grained 12-zone variant **exceeds** it:
it enforces "cross-bridge imports forbidden," a rule this project's own
lint message claims but nothing currently checks.

**Two fidelity gaps to weigh against that gain:**
1. Boundary checking is reachability-gated (inherits Spike 010's
   entry-point sensitivity) -- a violation in dead/unreachable code is
   invisible to Fallow but caught by ESLint's glob-based, reachability-blind
   `no-restricted-paths`. Fallow is not a strict superset; each tool catches
   something the other misses.
2. Translating ESLint's deny-based zones to Fallow's allow-based model is
   manual, error-prone work -- there's no automatic converter, and the
   `message` strings (not the `from` arrays) are the only reliable source
   for what to actually write as `allow` lists, as the cross-bridge case
   demonstrates.

**Whether to adopt:** the fine-grained config is worth having as a
*second*, complementary gate specifically for the cross-bridge gap it
closes -- but it should not replace the existing ESLint
`no-restricted-paths` config, given the reachability blind spot working in
the opposite direction.
