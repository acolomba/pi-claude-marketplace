---
phase: 03-marketplace-add
fixed_at: 2026-10-16T00:00:00Z
review_path: .planning/phases/03-marketplace-add/03-REVIEW.md
iteration: 2
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-10-16
**Source review:** .planning/phases/03-marketplace-add/03-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 4 (WR-01..WR-04; Info findings IN-01..IN-05 excluded by `critical_warning` scope)
- Fixed: 4
- Skipped: 0

**Where verification ran:** in the main checkout
(`/home/acolomba/src/pi-claude-marketplace-cucumber-behavioral-tests`), not in an isolated
worktree. The root-pin guard requires the commit root to be that checkout, and a fresh
worktree would have no `node_modules` for the required gates. Before each commit:
`npx tsc --noEmit -p .`, `eslint --max-warnings 0 features`, `npm run test:cucumber`
(41 scenarios, 324 steps, all passed after every fix), `CI=1 npm run check:features` (passed,
51 scenarios, now 22 step definitions), and `SKIP=npm-check pre-commit run --files <changed>`.
The commit hook's `npm run check:commit` passed on every commit.

**Order applied:** WR-01 and WR-02 together (one commit), then WR-03, then WR-04. WR-01 and
WR-02 are about the same step, and WR-03 reuses the library check that the WR-02 fix adds.

## Fixed Issues

### WR-01: In the ADD-04 Outline, the `<second marketplace>` column holds step text, and its row-1 step verifies nothing its text claims

**Files modified:** `features/marketplace/add.feature`, `features/step_definitions/marketplace/add.steps.ts`, `features/lib/published-marketplace.ts`
**Commit:** 9834bfa3 (shared with WR-02)
**Applied fix:** Removed the `<second marketplace>` column and both of its steps. Every row of
the one ADD-04 Outline (D-01 holds: both variants, dir and `@url` rows) now runs a single Given:
`Given a second marketplace declaring the name "tools" can be added from "tools-copy"`. The
Examples are back to `source kind | source | second source`, which is the shape shown in
03-CONTEXT. The step says *a second* marketplace, so "the marketplace "tools"" names only the
first one. The step requires the first marketplace to be published (it takes that
marketplace's kind). A comment on the step says that the same-source rows publish the copy and
never add it. The step text names add ("can be added"), and the statement stays true for those
rows. Scenario and step counts are unchanged (41/324). One step definition fewer (22).

### WR-02: The kind-shared step "is also published in the directory" names a filesystem directory for the url rows

**Files modified:** `features/marketplace/add.feature`, `features/step_definitions/marketplace/add.steps.ts`, `features/lib/published-marketplace.ts`
**Commit:** 9834bfa3 (shared with WR-01)
**Applied fix:** The new step text uses the kind-neutral words "can be added from "tools-copy"".
These words fit a directory and a repository alike. The free-location assertion moved out of
the step into a new library function, `requireFreeRoot(marketplacesRoot, directory, kind)` in
`features/lib/published-marketplace.ts`. It switches on kind. For dir and file it asserts
`stat` rejects with `ENOENT` (message `<directory> already holds a marketplace`) and returns the
root. For url and github it throws `noStandIn`, so the url stand-in can add its own check
without a step change. Negative check: the location was temporarily edited to `"tools"` and
reverted from a backup. Both dir rows then failed in the Given with
`tools already holds a marketplace`.

### WR-03: `the marketplace {string} is published as a {source kind} source` does not assert that its directory is free

**Files modified:** `features/step_definitions/marketplace/publishing.steps.ts`
**Commit:** 64837e0d
**Applied fix:** The basic publish step now gets its root from `requireFreeRoot` before it
registers the release and writes. Both publish steps now share one check, and the step no
longer builds the path itself. The `offers these plugins` republish step is deliberately not
guarded, because it rewrites the marketplace in its own directory. Negative check: a temporary
`Given the marketplace "tools-copy" is published as a <source kind> source` was inserted after
the second-marketplace Given, then reverted from a backup. Both dir rows then failed in that
Given with `tools-copy already holds a marketplace`.

### WR-04: The WR-05 fix anchors the gate rationale to ADD-07, which does not state it

**Files modified:** `features/step_definitions/marketplace/add.steps.ts`
**Commit:** 2d537559
**Applied fix:** The comment above the manifest-problem steps now reads "One literal text per
row variant rather than one text with a parameter: a misspelled variant is then an undefined
step, which the feature gate rejects even in a row the default profile excludes
(`.agents/skills/cucumber/rules/steps.md`)". It cites the rule file, not a planning decision ID.
A short comment above the two directory-state steps (ADD-06) points to the same reason. The
ADD-04 literal texts that the finding also mentioned were removed by the WR-01 fix.

## Notes for the operator

- The convergence guidance accepted this trade-off: the same-source rows publish a copy they do
  not add. The step's comment says so. These rows lose no protection, because the copy does
  not affect an add of the first source.
- Info findings were not in scope. The new `requireFreeRoot` partly addresses IN-05's second
  bullet: the publish step no longer builds the root path itself. But `publishMarketplaceIn`
  still joins the same path. IN-01 (the git-kind doc sentence on `publishMarketplaceIn`), IN-02,
  IN-03, IN-04, and IN-05's `breakManifest` bullet are unchanged.

---

_Fixed: 2026-10-16_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
