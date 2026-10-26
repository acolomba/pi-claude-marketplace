---
phase: 03-marketplace-add
reviewed: 2026-10-16T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - features/lib/path-marketplace.ts
  - features/lib/published-marketplace.ts
  - features/marketplace/add.feature
  - features/marketplace/remove.feature
  - features/step_definitions/marketplace/add.steps.ts
  - features/step_definitions/marketplace/publishing.steps.ts
  - features/support/world.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 3: Code Review Report (re-review after 258ccb32..9cff4690)

**Reviewed:** 2026-10-16
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

I reviewed the seven files against the cucumber skill and its four rules files, the typescript-style skill (comments rule), `AGENTS.md`, and the locked decisions in `03-CONTEXT.md`. I also checked each fix in `03-REVIEW-FIX.md` against its commit. Gate results on this tree:

- `npm run test:cucumber`: 41 scenarios passed, 324 steps passed.
- `CI=1 npm run check:features`: passed (51 scenarios, 23 step definitions).
- `eslint --max-warnings 0` on the five `.ts` files: exit 0.

How each fix holds up:

- **WR-03** (`root` on the record): correct and complete. `invalidateManifest` writes to `published.root`, and both callers pass the record.
- **WR-04** (`ScenarioWorld.requirePublished`): correct. Both private copies are gone. `publishedMarketplace()` stays, with one caller that needs the "not yet published" check.
- **WR-05** (citations): mostly correct. One new anchor points at the wrong spec row (WR-04 below).
- **WR-06** (directory-free assertion): correct for the step it touched. The sibling `is published as` step still lacks the same guard (WR-03 below).
- **WR-02**, ADD-06 half (`Given the directory "<directory>" to add <directory state>`): reads clearly. `<directory>` holds a directory name and `<directory state>` holds a state. Every row now states its own precondition, and the `does not exist` step asserts `ENOENT` instead of relying on the `Before()` hook silently. This half is within the features.md and steps.md rules.
- **WR-02**, ADD-04 half (`Given the marketplace "tools" to add again <second marketplace>`): this half brings new problems (WR-01 and WR-02 below). The column holds a verb phrase, not a marketplace. The row-1 step sets up nothing and checks nothing that its text claims. The url rows will read "in the directory" for a git repository.

No scenario lets a plausible wrong implementation of `add` pass:

- The ADD-04 row 2 catches a check that compares sources instead of names.
- The config check catches an overwrite.
- The `~/` row of ADD-06 catches a subject named by the resolved path.

So no finding is a BLOCKER. I did not re-raise the locked items: D-05 (failure scenarios check the failed result only), D-01/D-03 (one Outline each, dir and `@url` rows for ADD-04), and D-08 (no reload in the `--local` scenarios).

## Warnings

### WR-01: In the ADD-04 Outline, the `<second marketplace>` column holds step text, and its row-1 step verifies nothing its text claims

**File:** `features/marketplace/add.feature:151`, `:165-174`; `features/step_definitions/marketplace/add.steps.ts:46-51`
**Issue:** The WR-02 fix moved part of the Given's step text into an Examples column. That causes three problems:

1. **The placeholder does not name its value.** features.md says "Its `<placeholder>` names say what each value is." `<second marketplace>` holds `is the one already added` or `is also published in the directory "tools-copy"`. These are predicates about how the marketplace is published, not marketplaces. ADD-06's `<directory state>` names its value correctly. `<second marketplace>` does not.
2. **The row-1 step is a placeholder with no meaning of its own.** `the marketplace {string} to add again is the one already added` only calls `this.requirePublished(name)`. The Given on line 150 has already required the same thing. The fact the step states, that the When adds the source already added, depends on the `<second source>` column, and the step never sees that column. So the step's text and the command can contradict each other and the Given still passes. For example, `is the one already added` with `{home}/marketplaces/tools-copy` passes the Given, then fails in a `Then` as `source missing`. Per steps.md, a broken precondition must fail in the `Given`. Here the step has no precondition of its own to check. It exists only so that every row has some text in that slot.
3. **"The marketplace "tools"" now names two marketplaces.** Row 2 publishes a *second* marketplace that declares the same name. The step's own comment says the world refuses to record it, because "it would replace the first" (`add.steps.ts:64`). The step text still calls it *the* marketplace "tools" and says it "is also published", which reads as the same marketplace in a second place. D-01 describes "a second marketplace ... whose manifest declares the same name", and the replaced text (`another marketplace named "tools"`) said so. features.md: "Use the definite article for a specific thing."

**Fix:** Keep one Outline (D-01). Give the column a name that says what it holds, and phrase row 2 as a second marketplace:

```gherkin
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the project scope
    Given the second marketplace to add <second marketplace setup>
    When the user runs "/claude:plugin marketplace add <second source> --scope project"
    ...
      | source kind | source                    | second marketplace setup                    | second source                  |
      | dir         | {home}/marketplaces/tools | is the marketplace "tools" again            | {home}/marketplaces/tools      |
      | dir         | {home}/marketplaces/tools | declares "tools" from "tools-copy"          | {home}/marketplaces/tools-copy |
```

Alternatively, have the row-1 step record the source it claims (for example, `this.requirePublished(name).source` on a world field), and have a check compare that field with the source the When typed. Then the step's claim is something the run can fail on. If the operator prefers the current wording, at least rename the placeholder (for example `<second marketplace setup>`).

### WR-02: The kind-shared step "is also published in the directory" names a filesystem directory for the url rows

**File:** `features/marketplace/add.feature:172-174`; `features/step_definitions/marketplace/add.steps.ts:53-67`; `features/lib/published-marketplace.ts:75-80`
**Issue:** The ADD-04 Outline is shared by the dir and `@url` blocks. Its row-2 step text now says `in the directory "tools-copy"`, and the step asserts `ENOENT` on `marketplacesRoot/<directory>`. In the url row the user adds `https://{git host}/acme/tools-copy.git`, a repository that a git stand-in serves. That row will read "published in the directory tools-copy". Turning `"tools-copy"` into `acme/tools-copy.git` is a mapping that only the library knows: the doc comment's "For a git kind, `directory` is the repository its stand-in serves". world-and-stand-ins.md says "A new source kind changes library code only, not the steps". When Phase 9 removes `@url`, either this step text describes the url row wrongly, or the step must change. The `ENOENT` check on a HOME path also tests nothing for a git stand-in. The previous IN-03 asked for "the directory" when every row was a dir row. Because this step is kind-shared, it needs a neutral noun.
**Fix:** Use kind-neutral wording, and leave the location to the library, as `publishMarketplaceIn` already does:

```gherkin
| is also published as "tools-copy" | {home}/marketplaces/tools-copy |
```

The step can be `the marketplace {string} to add again is also published as {string}`, or the WR-01 rewrite. Move the "location is free" assertion into `publishMarketplaceIn`, keyed by kind, so the url stand-in can assert that its own repository is free.

### WR-03: `the marketplace {string} is published as a {source kind} source` does not assert that its directory is free, unlike its sibling after the WR-06 fix

**File:** `features/step_definitions/marketplace/publishing.steps.ts:23-34`
**Issue:** The WR-06 fix guards `... is also published in the directory {string}` with `assert.rejects(stat(root), { code: "ENOENT" })`. The basic publish step has no such guard. It checks only the world's name map (`publishedMarketplace(name)`), and the unrecorded second marketplace is deliberately kept out of that map (`add.steps.ts:64`). Example: a later scenario publishes the duplicate in `"tools-copy"` and then writes `Given the marketplace "tools-copy" is published as a dir source`. The second step overwrites the `tools` manifest in `tools-copy` without failing, and it registers a second release of the same root. steps.md says "A `Given` that performs setup asserts that the setup succeeded". Here the setup silently clobbers another fixture, and the failure appears in a later `Then` if anywhere. The suite now guards one of the two publish steps and not the other.
**Fix:** Apply the same assertion before the release is registered:

```ts
const root = path.join(this.marketplacesRoot, name);
await assert.rejects(stat(root), { code: "ENOENT" }, `${name} already holds a marketplace`);
this.onRelease(() => rm(root, { recursive: true, force: true }));
```

Better still, put this check in `publishMarketplaceIn`, so both steps share it (see WR-02).

### WR-04: The WR-05 fix anchors the gate rationale to ADD-07, which does not state it

**File:** `features/step_definitions/marketplace/add.steps.ts:29-31`
**Issue:** The comment reads: "Two literal texts rather than one with a parameter: a misspelled problem in a row the default profile excludes is then an undefined step, which the feature gate rejects (ADD-07)." ADD-07 (`REQUIREMENTS.md:53`) says "A malformed or schema-invalid manifest fails as `invalid manifest` (dir, url)". It says nothing about excluded rows or the feature gate. The rationale is 01-CONTEXT D-09, which the cucumber SKILL.md cites for the same behavior: "the gate dry-runs every scenario, ignoring the `not @url and not @github` exclusion". Per the comments rule, an anchor links the code to the spec row that holds the claim. This anchor sends a reader to a row that does not hold it. Comment findings are WARNING per the typescript-style skill. The same rationale now also covers the two new literal texts that WR-02 added (`... is the one already added`, `... does not exist`), and the comment does not say so.
**Fix:**

```ts
// One literal text per row variant rather than one with a parameter: a
// misspelled variant in a row the default profile excludes is then an
// undefined step, which the feature gate rejects (D-09).
```

Move it above the first of the literal-text groups, or repeat it where the ADD-04 and ADD-06 variants are registered.

## Info

### IN-01: The doc comment of `publishMarketplaceIn` still describes behavior the function does not have (prior IN-01, now anchored to ADD-04)

**File:** `features/lib/published-marketplace.ts:75-80`
**Issue:** The comment says "For a git kind, `directory` is the repository its stand-in serves". Both git kinds throw `noStandIn`. The WR-05 fix added `(ADD-04)` to this sentence, so the anchor now vouches for a claim the code does not support. The new `root` field doc ("the directory it is published in") has the same gap for git kinds.
**Fix:** "The url and github kinds throw until they have a stand-in (ADD-04)."

### IN-02: `publishMarketplaceIn` still takes two adjacent `string` parameters that are easy to swap (prior IN-02)

**File:** `features/lib/published-marketplace.ts:81-87`
**Issue:** `(marketplacesRoot, directory, name, kind, plugins)`. A swapped `directory` and `name` still type-checks. The call at `add.steps.ts:65` is correct.
**Fix:** Take `{ directory, name }` as an options object.

### IN-03: Inconsistent parameter names across the two ADD-06 steps (prior IN-03, second half)

**File:** `features/step_definitions/marketplace/add.steps.ts:69-74`, `:76-86`
**Issue:** In the new `... to add does not exist` step, the parameter `directory` holds a directory *name*. In the next step, the parameter for the same placeholder is `name`, and `directory` is the *path*. The two steps are fed by the same `<directory>` column, and they use the same identifier for different things.
**Fix:** In both steps, name the parameter `directory` and the joined path `root`.

### IN-04: The remove feature description claims more than its scenario observes (prior IN-04)

**File:** `features/marketplace/remove.feature:3-5`, `:7-27`
**Issue:** The description says that removal drops the marketplace "with its declaration and the plugins installed from it". 03-CONTEXT line 52 says `remove --local` "clears the local entry and the record". The scenario observes only the two config files and the result row. A `remove --local` that rewrites `claude-plugins.local.json` and reports `removed`, but leaves the scope's record in place (still listed), passes. The title ("clears only its local declaration") is scoped narrowly enough that this is not a false pass of the title. The scenario's result row is still the only observation of the record. Checking the record needs a second When (`marketplace list`, not a reload, so D-08 is not affected), so it belongs in its own scenario.
**Fix:** Phase 4 (D-07) should add a scenario that a list after `remove --local` no longer shows the marketplace, plus the plugin-cascade scenario. Until then, narrow the description.

### IN-05: Leftovers from the WR-03/WR-04 fixes

**File:** `features/step_definitions/marketplace/add.steps.ts:21-27`; `features/step_definitions/marketplace/publishing.steps.ts:30-32`
**Issue:**
- After WR-04, `breakManifest` is a one-line wrapper around `invalidateManifest(name, world.requirePublished(name), problem)`. It adds nothing that the shared `has become invalid` step does not already inline.
- After WR-03, the record carries `root`, but the publish step still builds the same path itself (`path.join(this.marketplacesRoot, name)`) to register its release. That makes two sources for the "directory of its own name" rule.

**Fix:** Inline `breakManifest`. Optionally, have `publishMarketplaceIn` export or compute the root that the step registers. The release must still be registered before the write.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
