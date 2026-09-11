---
phase: 09-final-quality-and-backlog-closure
fixed_at: 2026-09-11T00:00:00Z
review_path: .planning/phases/09-final-quality-and-backlog-closure/09-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: complete
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-09-11
**Source review:** `.planning/phases/09-final-quality-and-backlog-closure/09-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 3 (0 critical, 3 warning)
- Fixed: 3
- Skipped: 0
- Info findings (`IN-01` through `IN-04`): deliberately not in scope — see "Deferred" below

Two of the three fixes departed from the remedy the review proposed. Both departures are
recorded here with the measurement that motivated them, because in each case the proposed
remedy would have cost more than the finding.

## WR-01 — fixed

**Commit:** `1228b178` `test(hooks): pin readHooksJson to its utf-8 decode`
**File:** `tests/bridges/hooks/stage.test.ts`

The byte-fidelity case reused the ASCII-only `EXPECTED_HOOKS_BYTES` constant from the write
path, so a `readFile(p, "latin1")` implementation would have passed it. Encoding is the only
behavior `readHooksJson` adds beyond delegating, and it was the part left unpinned — no coverage
gate can see the difference, because both spellings execute the same lines.

The read case now has its own non-ASCII fixture (`é` U+00E9, `✓` U+2713). Assertion style and
case structure are unchanged: two identifier swaps plus the new constant.

**Proved by planting.** With `readFile(hooksJsonPath, "latin1")` planted in `stage.ts`, the file
goes red — `✖ reads back the exact bytes written to a hooks.json path`, 19/20. Reverting the
plant restores 20/20.

**One incidental constraint worth recording:** the fixture deliberately avoids an em dash.
`.pre-commit-config.yaml:60` runs `fix-unicode-dashes` over this path (only `.planning/`,
`scripts/revalidation.mjs`, and `tests/architecture/revalidation.test.ts` are excluded), so an
em dash in the literal would have been silently rewritten to `--` and the fixture would have
stopped discriminating without anyone noticing.

## WR-02 — fixed, by correcting the comment rather than wiring the helper

**Commit:** `064398e5` `docs(hooks): state where the hooks path join is composed`
**File:** `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:37-48`

`hookConfigPathFor`'s comment promised the path composition would be used "(later) by any
hydrate-side reader so the same composition is never duplicated". The hydrate-side reader landed
in this phase and composed the join inline anyway, so the comment stated a contract the code did
not keep.

The review offered two remedies and treated them as equivalent. They are not, and the asymmetry
is what decided it. Routing `event-router.ts` through `hookConfigPathFor` would have had to
reverse three recorded facts:

1. `bridges/hooks/index.ts:26-27` documents `hookConfigPathFor` as deliberately not re-exported.
2. `orchestrators/plugin/info.ts:506-510` records its own inline join as the consequence of that,
   and names `event-router.ts`'s hydrate path as doing the same.
3. `tests/architecture/gate-targets.ts:597-600` pins `hookConfigPathFor` in
   `UNOWNED_EXPORT_CENSUS` — the production-unowned-export measurement whose gate compares for
   **exact** equality. Giving it a production consumer forces an edit to that pinned set in the
   same commit.

So wiring costs a change to the tree's export-ownership surface plus two comment reversals;
correcting the comment costs one comment. The comment now states what is true — write path only,
off the barrel, both read sites composing inline under `D-57-03`, containment carried by each
caller's own `assertPathInside` — with no narration of a removed shape, per
`.claude/rules/typescript-comments.md`. The three files agree.

**What this cost:** the duplication the original comment aspired to remove is still present in
three places. It is now documented as intentional rather than as a pending promise, which is the
honest state, but it is not the same as removing it.

## WR-03 — fixed, by making the lookup total rather than by adding a presence check

**Commit:** `0ac328a0` `fix(revalidation): keep the sealed route lookup total`
**Files:** `scripts/revalidation.mjs:92,129-141`, `tests/architecture/revalidation.test.ts`

`SEALED_REQUIREMENT_ROUTES[requirementId]` was dereferenced with no presence check while the
gating ID set was derived from `SEALED_REQUIREMENT_SIGNATURES`. If the two keysets drifted, the
validator threw a `TypeError` instead of reporting a violation — a gate that crashes rather than
failing closed. The finding was pre-existing, but this phase edited that exact table (eight
entries moved `Pending` → `Complete`), and a gate that reports a crash instead of a finding is
the defect class this milestone exists to retire.

**The defect was confirmed real, not theoretical**, against a copy of the validator with
`SEALED_REQUIREMENT_ROUTES["AUTH-01"]` deleted:

```
Cannot read properties of undefined (reading 'route')
exit=1
```

**Why the specified `Object.hasOwn` guard was not used.** Its arm is unreachable from every
caller — `validateRequirementDisposition` is module-private and both tables are module
constants, so no test can enter it. `scripts/revalidation.mjs` is a `specialPairs` entry in the
direct-coverage gate (`scripts/test-coverage-direct.mjs:19`), runs in CI (`ci.yml:183`) and in a
pre-commit hook keyed on that exact path. Its measured baseline before the change was
**branches 789/789, functions 202/202, lines 2660/2660**, with no row in
`scripts/test-coverage-direct.pin.json`. Adding an uncoverable branch drops it to 788/789, which
that gate refuses unless a pin row is added recording a new coverage shortfall — in the
milestone whose phase 8 exists to retire them. That trade is worse than the finding.

**What was done instead.** `SEALED_REQUIREMENT_IDS` moved below the routes table and is now
derived from the table it dereferences:

```js
const SEALED_REQUIREMENT_IDS = new Set(Object.keys(SEALED_REQUIREMENT_ROUTES));
```

The dereference is total by construction — no branch, no coverage cost, and no runtime check to
forget. The same plant now reports four violations naming the unsealed ID instead of a stack
trace:

```
phase-requirements: PHASE-04: roadmap membership differs from sealed requirement routes
unexpected-requirement-definition: AUTH-01: scope row is absent
unexpected-requirement-route: AUTH-01: scope row is absent
unexpected-scope-requirement: AUTH-01: requirement is absent from sealed stable-ID set
exit=1
```

The opposite drift direction was already reported, because `validateRequirementClause` *compares*
`SEALED_REQUIREMENT_SIGNATURES[id]` rather than reading through it — a sealed ID with no
signature emits `requirement-signature`. Both directions now fail closed.

**Behavior today is unchanged.** The two keysets are byte-identical in membership and order (32
each, both sorted), so the derived set is the same set. No sealed entry, message text, or passing
outcome was touched. `.planning/REQUIREMENTS.md` and `01-REVALIDATION.json` are untouched.

**Two cases added (136 → 138):**

- `RVAL-04 seals the same requirement IDs in the signature and route tables` — the keyset pin.
  Reads both frozen tables out of the validator's source (both are module-private) and compares
  membership, pinning the length at 32 so a scan that stopped matching cannot pass vacuously as
  two empty lists.
- `RVAL-04 scope-impact reports a sealed requirement whose route entry is absent` — plants the
  drift in a copied validator and pins the four reported violations. This exists because the
  keyset pin alone would stay green if the derivation were reverted, and the latent crash would
  return. **Verified by planting:** reverting the derivation makes this case fail, 137/138.

`runCli` gained an optional third parameter (the CLI path, defaulting to the canonical one) so
the copy can be run. No call site changed.

## Deferred — Info findings, not fixed

`IN-01` through `IN-04` remain recorded in `09-REVIEW.md` and were deliberately left alone.

`IN-02` is the one worth an operator decision rather than silent deferral. The reviewer's
judgement on the interface shape this phase chose: the segregation is right, the naming is not —
`HooksHydrationReader` is not a kind of file reader, it is a two-member dependency bundle, and
`extends HooksFileReader` asserts an is-a relationship that is only structurally true. Renaming
would touch the published bridge surface and roughly 171 call sites for a naming improvement,
which is a scope decision for the operator, not something a fix pass should take.

## Gate results after all three fixes

| Gate | Result |
|---|---|
| `node scripts/revalidation.mjs scope-impact --check` | `Scope impact valid: 40 records.` exit 0 |
| `node --test tests/architecture/revalidation.test.ts` | tests 138, pass 138, fail 0 |
| `node --test tests/bridges/hooks/stage.test.ts` | tests 20, pass 20, fail 0 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | 6009/6009 pass, exit 0 |
| `npm run test:corresponding` | exit 0 |
| `npm run test:corresponding:negative` | exit 0 |
| `npm run test:coverage:direct:negative` | exit 0 |
| direct coverage, revalidation pair | branches 789/789, functions 202/202, 100% |

`SKIP=trufflehog pre-commit run --files …` was run and clean before each of the three commits.
