---
phase: 03-marketplace-add
fixed_at: 2026-10-16T00:00:00Z
review_path: .planning/phases/03-marketplace-add/03-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 5
skipped: 1
status: partial
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-10-16
**Source review:** .planning/phases/03-marketplace-add/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (WR-01..WR-06; Info findings excluded by `critical_warning` scope)
- Fixed: 5
- Skipped: 1

**Where verification ran:** in the main checkout
(`/home/acolomba/src/pi-claude-marketplace-cucumber-behavioral-tests`), not in an isolated
worktree. The orchestrator's root-pin guard requires the commit root to be that checkout,
and a fresh worktree would have no `node_modules` for the required gates. Each commit was
preceded by `npm run typecheck`, `eslint --max-warnings 0 features`, `npm run test:cucumber`
(41 scenarios, 324 steps, all passed after every fix), `CI=1 npm run check:features` (passed;
23 step definitions after WR-02), and `SKIP=npm-check pre-commit run --files <changed>`. The
commit hook's `npm run check:commit` passed on every commit.

**Order applied:** WR-03, WR-04, WR-05, WR-06, then WR-02. WR-02 rewrites the step that
WR-05 and WR-06 also touch, and its new step uses the world's `requirePublished` from WR-04.

## Fixed Issues

### WR-03: `invalidateManifest` rebuilds the fixture path from the name and ignores how the marketplace was published

**Files modified:** `features/lib/published-marketplace.ts`, `features/step_definitions/marketplace/add.steps.ts`, `features/step_definitions/marketplace/publishing.steps.ts`
**Commit:** 258ccb32
**Applied fix:** `PublishedMarketplace` now carries `root`, the directory it was published in.
`publishMarketplaceIn` returns it for the dir and file kinds. `invalidateManifest` writes to
`published.root` and no longer takes `marketplacesRoot`. Both callers were updated.

### WR-04: `add.steps.ts` re-implements `requirePublished` from `publishing.steps.ts`

**Files modified:** `features/support/world.ts`, `features/step_definitions/marketplace/add.steps.ts`, `features/step_definitions/marketplace/publishing.steps.ts`
**Commit:** d057ce3e
**Applied fix:** Added `ScenarioWorld.requirePublished(name)` (look up or `assert.fail` with the
same message). Deleted the private `requirePublished` from `publishing.steps.ts` and the
inline copy in `add.steps.ts`'s `breakManifest`. `publishedMarketplace()` stays, because the
"is published as a ... source" step still uses it for its not-yet-published check.

### WR-05: Decision IDs D-01 and D-04 now mean two different decisions in the suite

**Files modified:** `features/lib/published-marketplace.ts`, `features/step_definitions/marketplace/add.steps.ts`
**Commit:** 98282c76
**Applied fix:** The four citations of 03-CONTEXT decisions now cite requirement rows:
`publishMarketplaceIn` uses `(ADD-04)`; `invalidateManifest` and the two-literal-texts comment
use `(ADD-07)`; the "not recorded" comment uses `(ADD-04)`. The 01-CONTEXT `D-04` citations
(HOME fixtures, `published-marketplace.ts` lines 5 and 64) are unchanged.

### WR-06: The "another marketplace" Given does not assert that its setup leaves the first marketplace intact

**Files modified:** `features/step_definitions/marketplace/add.steps.ts`
**Commit:** 014c182e
**Applied fix:** Before it publishes, the step asserts that `stat(root)` rejects with `ENOENT`
(message `<directory> already holds a marketplace`), then registers the release. A temporary
negative check (row edited to `in "tools"`, reverted with `git checkout`) failed in the Given
with that message, as intended.

### WR-02: Outline rows run setup that has nothing to do with them, and rely on preconditions no step states

**Files modified:** `features/marketplace/add.feature`, `features/step_definitions/marketplace/add.steps.ts`
**Commit:** 9cff4690
**Applied fix:** Each Outline is still ONE Outline with the same rows (D-01, D-03 hold). Each
gains a column that chooses the one Given the row needs, the same pattern ADD-07 uses for
`<manifest problem>`:
- ADD-04: `Given the marketplace "tools" to add again <second marketplace>`, where the column
  holds `is the one already added` (the same-source rows; the step asserts the marketplace is
  published) or `is also published in the directory "tools-copy"` (replaces the old "another
  marketplace named ... in ..." step; it reuses the first marketplace's source kind and keeps
  the WR-06 assertion). Both the dir and `@url` blocks have both rows.
- ADD-06: `Given the directory "<directory>" to add <directory state>`, where the three
  `missing` rows read `does not exist` (a new step that asserts `ENOENT` on the directory) and
  the `empty` row reads `holds no marketplace manifest` (the existing step).

The scenario count (41) and step count (324) are unchanged. The operator may want to review the
new step wording, because a reader judges these WARNING-level findings.

## Skipped Issues

### WR-01: The ADD-06 and ADD-07 failures do not check that the failed add leaves nothing behind

**File:** `features/marketplace/add.feature:176-219`
**Reason:** contradicts locked decision D-05. The user chose, with this trade-off presented,
that the ADD-06/ADD-07 failure scenarios check the failed result only, with no seeded base file
or follow-up persistence check.
**Original issue:** "Source missing" and "invalid manifest" compare only the envelope and the
failed row. Neither checks that the failure left `claude-plugins.json` or the state record
untouched (NFR-3 fail-clean).

---

_Fixed: 2026-10-16_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
