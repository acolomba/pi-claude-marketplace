---
phase: 95-manifest-independent-installed-inventory
fixed_at: 2026-08-08T20:35:00Z
review_path: .planning/phases/95-manifest-independent-installed-inventory/95-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 95: Code Review Fix Report

**Fixed at:** 2026-08-08T20:35:00Z
**Source review:** `.planning/phases/95-manifest-independent-installed-inventory/95-REVIEW.md`
(iteration 2)
**Iteration:** 2 (cumulative -- iteration 1 is summarized at the end)

**Summary (iteration 2):**

- Findings in scope (`critical_warning`): 3 (WR-05, WR-06, WR-07)
- Fixed: 3
- Skipped: 0

Two Info findings were fixed opportunistically (IN-06, IN-08); two were left
alone with a recorded reason (IN-07, IN-09). One sub-claim of WR-05 is deferred
to Phase 96 -- see the deferral note under that finding.

## Fixed Issues

### WR-05: the claim-authority gate suppressed instead of re-evaluating (INV-01 false negative)

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`,
`tests/orchestrators/plugin/list-manifest-absent.test.ts`
**Commit:** `06875fa4`
**Applied fix:** The iteration-1 fix answered "is the record's own manifest the
one the block header names" and dropped the brace when it was not. A record
genuinely absent from a manifest that loaded cleanly therefore stated nothing.

The authority question is now settled the other way: a row is a statement about
its own record, so the manifest that record names is what its absence is judged
against, on the fold path exactly as on any same-scope block.
`ownsAbsenceClaim` and the `claimAuthorityPath` parameter are gone;
`loadMarketplaceManifestSoftly` again reads one manifest and answers one
question.

`ScopedManifest` became a discriminated union:

```ts
type ScopedManifest =
  | { readonly ok: true; readonly manifest: MarketplaceManifest }
  | { readonly ok: false; readonly loadError: string };
```

That matters for WR-06 as well as for readability. The previous
`manifest: T | undefined` + `loadError: string | undefined` pair could express
two contradictory states, and the enumerator's guard had to name both halves --
which is what let a reviewer delete one conjunct with no test noticing. With
one discriminant there is one check (`scopedManifest.ok`), and no redundant
conjunct exists to be silently removed.

BOUND-03 is unchanged in behavior: a read failure yields no claim, the folded
row survives with its bare `(installed)` token and its `[project]` bracket.

**Deferred sub-claim -- WR-05(b), the `(upgradable)` / `description` axis:**
skipped deliberately, recorded for Phase 96 (BOUND-01 / BOUND-02). The review
framed it as an incoherent authority model, and under the iteration-1 design it
was: one manifest was trusted for the version compare and distrusted for the
absence. After this fix that incoherence is gone -- ALL three facts (absence,
PL-5 upgradability, PL-4 description) now derive from the same manifest, the
record's own. What remains is the older, separate question of whether a folded
row should describe the project record's manifest or the user block's at all.
That predates this phase, changes rendered output for a shape no requirement
currently pins, and belongs with BOUND-01/BOUND-02 rather than here.

### WR-06: the BOUND-03 load-error test was vacuous

**Files modified:** `tests/orchestrators/plugin/list-manifest-absent.test.ts`
(same commit as WR-05 -- the test's expected output is a direct consequence of
the production change)
**Commit:** `06875fa4`
**Applied fix:** With claim authority removed, the failed-read fixture at
`list-manifest-absent.test.ts` now isolates the axis its name claims: the two
records still name different manifest paths, but that no longer participates in
the decision, so the load failure is the only thing suppressing the brace.

Verified by mutation rather than by inspection. Rewriting the guard as
`const notInManifest = manifestEntry === undefined;` (dropping the read-success
check) fails exactly one test -- `BOUND-03: a folded row whose project-side
manifest FAILED to load is preserved and carries no reason brace` -- and no
others. The guard bites. The production file was restored from a pre-mutation
copy immediately afterward.

The complementary direction was already covered and is now joined by a second
case:

- record-own manifest LOADS and omits the record -> brace renders
  (`BOUND-03: ... LOADED without the entry`)
- record-own manifest FAILS to load -> brace suppressed, row survives
  (`BOUND-03: ... FAILED to load`)

The previously vacuous divergent-path test was rewritten rather than deleted:
`INV-01: a folded row absent from its OWN manifest claims the absence even when
the user block names another manifest`. It keeps the divergent fixture (shared
`marketplaceRoot`, project record naming `other.json`, user manifest declaring
`alpha`) and now asserts the brace DOES render, which is the INV-01 semantic
this iteration settled. Its comment states the BOUND-01/BOUND-02 question it
deliberately does not answer, so the fixture is not read as endorsing the
folded row's manifest choice.

### WR-07: two parameters that had to agree

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`
**Commit:** `c003405d`
**Applied fix:** `installedRowMessage` took `manifestEntry` and `notInManifest`
as separate parameters with an unenforced invariant -- the exact drift shape the
neighboring doc comment rejects. Collapsed to one discriminated value, as the
review proposed:

```ts
type ManifestLookup =
  | { readonly kind: "declared"; readonly entry: MarketplaceManifest["plugins"][number] }
  | { readonly kind: "absent" }
  | { readonly kind: "unverified" };
```

A row claiming `{not in manifest}` while deriving `(upgradable)` and a
description from an entry is now unrepresentable. The membership test moved into
`manifestLookupFor(scopedManifest, pluginName)`, adjacent to the read it
interprets, so the enumerator's installed loop is a single call.

This also drops `installedRowMessage` from eight positional parameters to seven
(partial relief for IN-09; see below). The aliased-condition narrowing that lets
`resolveStrict(manifestEntry, ...)` type-check without an extra guard survives
the change -- `manifestEntry` is still a `const` derived once at the top of the
function.

### IN-06 / IN-08: rationale-vs-fixture mismatch and dead seed options

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`,
`tests/orchestrators/plugin/list-manifest-absent.test.ts`
**Commit:** `8c3656b9`
**Applied fix:** Both are Info-tier hygiene in the same two files, committed
together rather than split.

IN-06: the `partiallyInstalledReasons` gate comment (mirrored in the test)
justified itself with a `partially-installed-upgradable` record, but the
guarding fixture seeds matching versions and never reaches that arm. Both
comments now state the rule the fixture actually pins -- a DECLARED degraded
record keeps its unsupported-kind tokens alone -- which is also the more general
statement. No new fixture was added; the upgradable arm is a version-compare
concern already covered elsewhere.

IN-08: `SeedMarketplaceOpts.manifest` was optional but passed by all 12 call
sites, so the `if (manifest !== undefined)` false arm was dead -- made required
and the branch removed. `scope` was `"user"` at all 12 sites (the project side
of the fold cases is seeded by `seedFoldedProjectClone`), so the parameter was
dropped and the helper documents that it seeds user scope. `scopeRoot` was kept:
callers compute `userRoot` for their own use (`sharedMpRoot`) and pass the same
value, so it carries real information rather than a constant.

## Skipped Issues

### IN-07: the catalog paragraph claims an on-disk check the list surface never runs

**File:** `docs/output-catalog.md:412`
**Reason:** Skipped by explicit scope instruction for this iteration. The
finding is correct -- the installed row derives from `state.json` alone and no
artifact-presence probe runs on that arm -- and the proposed one-line rewording
("the record is recorded installed in `state.json`") is the right fix. It is
left for the phase's documentation pass so the catalog is edited once.

### IN-09: eight positional parameters on `installedRowMessage`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`
**Reason:** Partially addressed and otherwise skipped by scope instruction.
WR-07 removed one parameter (eight to seven) and eliminated the adjacent
pair that could disagree, but the two adjacent `Scope` parameters
(`pluginScope`, `marketplaceScope`) remain swappable without a compile error.
The named-args-object conversion that `buildMarketplaceMessage` already uses is
the correct end state; it is a pure refactor with no behavior change and no
requirement attached, so it is not carried by this fix pass.

### WR-05(b): the folded row's `(upgradable)` / `description` manifest choice

**Reason:** Deferred to Phase 96 (BOUND-01 / BOUND-02). Full rationale under
WR-05 above -- the authority incoherence the finding describes is resolved by
WR-05's fix; the residual "which manifest should a folded row describe"
question predates this phase.

## Requirements Held Green

All byte-exact characterization tests pass unchanged except the one deliberately
rewritten under WR-06:

- INV-01 -- brace on manifest-absent installed rows (4 same-scope cases plus the
  two fold cases)
- INV-02 -- partial keeps status and reasons, `not in manifest` first, gated on
  absence (3 cases)
- INV-04 -- the canonical disabled row never carries the brace
- BOUND-03 -- a failed read never claims absence; the folded row survives
- INV-05 -- the tool payload carries reasons on all four installed-family arms
  (`tests/edge/handlers/tools.test.ts`)

## Verification

Per-fix: file re-read, `npx tsc --noEmit`, `npx eslint`, `npx prettier --check`,
targeted `node --test` on `tests/orchestrators/plugin/list-manifest-absent.test.ts`
and `tests/orchestrators/plugin/list.test.ts` (85 pass), and
`pre-commit run --files <changed>` before each commit. WR-06 additionally used
the mutation check described above.

Full gate: `PI_SUBAGENTS_ROOT=/home/acolomba/.pi/agent/npm/node_modules/pi-subagents
npm run check` exits 0 -- typecheck, lint, format:check, `npm test`
(3269 tests, 0 fail) and `npm run test:integration` (18 pass) all green.

**Where verification ran:** every gate ran in the working tree
`/home/acolomba/pi-claude-marketplace/.worktrees/manifest-independent-plugin-info`
(branch `features/manifest-independent-plugin-info`), the same tree the commits
landed in, so the numbers are reproducible from it. No separate agent worktree
was created and none was torn down.

The `trufflehog` pre-commit hook fails structurally in a linked worktree
(git-mode scan cannot read `.git/index`), so each commit was preceded by the
documented filesystem scan over the changed paths
(`--results=verified,unknown --fail`, `verified_secrets: 0` /
`unverified_secrets: 0` each time) and committed with `SKIP=trufflehog`. No
other hook was skipped.

## Iteration 1 (superseded, retained for history)

Iteration 1 fixed CR-01 (`89334294`), WR-01 (`d093b465`), WR-03 (`43d62143`,
`46a0efa6`) and WR-04 (`76d8440a`), and skipped WR-02 as out of phase scope by
`95-CONTEXT.md` assignment (Phase 98, DOC-08 -- `shared/notify.ts` still
documents the pre-INV-01 `installed` arm behavior; the two catalog states added
under WR-03 are the byte-level authority for what that comment should say).

Iteration 2 REPLACES the WR-01 fix. `ownsAbsenceClaim` and `claimAuthorityPath`
no longer exist; the iteration-1 rationale for preferring claim authority over
re-evaluation was rejected by the iteration-2 review and is superseded by the
WR-05 entry above. The CR-01, WR-03 and WR-04 fixes are untouched and were
confirmed still green.

---

_Fixed: 2026-08-08T20:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
