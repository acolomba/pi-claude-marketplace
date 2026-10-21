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
  warning: 1
  info: 7
  total: 8
status: issues_found
---

# Phase 3: Code Review Report (final round, after 9834bfa3..2d537559)

**Reviewed:** 2026-10-16
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

I reviewed the seven files against the cucumber skill and its four rules files, the typescript-style skill (comments and review rules), `AGENTS.md`, and the locked decisions in `03-CONTEXT.md`. I checked each round-2 fix in `03-REVIEW-FIX.md` against the diff `9cff4690..2d537559`.

Gate results on this tree:

- `npm run test:cucumber`: 41 scenarios passed, 324 steps passed, 16 hooks passed.
- `CI=1 npm run check:features`: passed (51 scenarios, 22 step definitions).
- `eslint --max-warnings 0` on the five `.ts` files: exit 0. `tsc --noEmit -p .`: clean.

How each round-2 fix holds up:

- **WR-01** (the `<second marketplace>` column): correct. The column and its two steps are gone. The Examples have the D-01 shape again (`source kind | source | second source`). The step says *a second* marketplace, so "the marketplace "tools"" names only the first one. The step requires the first marketplace and borrows its kind, so a missing first marketplace fails in the `Given`. The new wording brings one new problem (WR-01 below).
- **WR-02** (kind-neutral location): correct. "from "tools-copy"" fits a directory and a repository alike. The free-location check moved into `requireFreeRoot`, which dispatches on kind, so the url stand-in can add its own check without a step change (world-and-stand-ins.md).
- **WR-03** (free-location check in the basic publish step): correct and complete. Both publish steps call `requireFreeRoot` before they register the release and write. The release is still registered only after the check passes, so a step never deletes a location it does not own. The `offers these plugins` republish is rightly left unguarded.
- **WR-04** (comment anchor): correct for the manifest-problem steps. The ADD-07 Outline has `@url` rows, so the excluded-row rationale applies there, and steps.md states the gate behavior it cites. The new cross-reference above the ADD-06 steps borrows a rationale that does not apply to ADD-06 (IN-06).

Would a plausible wrong implementation of `add` or `remove` still pass? No:

- In ADD-04, row 1 catches an add that succeeds again for the same source. Row 2 catches a check that compares sources instead of names. The config check catches an overwrite.
- The `~/` row of ADD-06 catches a subject named by the resolved path.
- Both `--local` scenarios compare the whole contents of both files.

So no finding is a BLOCKER. I did not re-raise the locked items: D-05 (failure scenarios check the failed result only), D-01/D-03 (one Outline each), D-08 (no reload in the `--local` scenarios), and the ADD-04 same-source rows that publish a copy they never add.

## Warnings

### WR-01: The ADD-04 `Given` says the copy "can be added", and the scenario then shows that it cannot

**File:** `features/marketplace/add.feature:151`; `features/step_definitions/marketplace/add.steps.ts:53-62`
**Issue:** Row 2 reads like this:

```gherkin
Given a second marketplace declaring the name "tools" can be added from "tools-copy"
When the user runs "/claude:plugin marketplace add {home}/marketplaces/tools-copy --scope project"
Then the result lists these marketplaces:
  | name  | scope   | status | reasons        |
  | tools | project | failed | duplicate name |
```

The `Given` states that the copy can be added. The `When` adds it, and the `Then` and the title say that the add fails. features.md says a `Given` "states a precondition as a fact". Here, the scenario's own outcome contradicts the fact. A reader who does not open the step definition sees a precondition that the scenario disproves. This is the behavior the Outline exists to show. The modal "can be added" also describes an ability, not the state of the fixture. Protection is not affected: the step publishes the copy, and `requireFreeRoot` makes sure that the location is free. This is a wording finding, so WARNING.

The fixer chose "can be added" for good reasons. The text must name `add`, because the step is in a verb module (layout.md, D-08). It must also stay true for row 1, which never adds the copy (the accepted trade-off). "to add" would be false for row 1. So the replacement must meet three constraints: it names the verb, it states a fact about the fixture, and it does not claim that the add succeeds.

**Fix:** State where the copy is and what it is for, not whether the add works:

```gherkin
Given a second marketplace declaring the name "tools" is ready to add from "tools-copy"
```

```ts
Given(
  "a second marketplace declaring the name {string} is ready to add from {string}",
  async function (this: ScenarioWorld, name: string, location: string) { ... },
);
```

"Is ready to add from" describes the fixture's state. It is true in both rows, and it names the verb. Another option with the same properties is `... is published as "tools-copy" for the user to add`.

## Info

### IN-01: The doc comment of `publishMarketplaceIn` still describes git-kind behavior that the function does not have (carried over from round 2)

**File:** `features/lib/published-marketplace.ts:105-110`, `:39-47`
**Issue:** "For a git kind, `directory` is the repository its stand-in serves (ADD-04)." Both git kinds throw `noStandIn`, and the `(ADD-04)` anchor vouches for a claim that the code does not support. `requireFreeRoot`, eight lines above, now says correctly that "the url and github kinds throw until they have a stand-in". So the two doc comments in one module disagree. The `root` field doc ("the directory it is published in") has the same gap for git kinds.
**Fix:** Replace the sentence with "The url and github kinds throw until they have a stand-in.", which is the wording that `requireFreeRoot` uses.

### IN-02: `publishMarketplaceIn` and `requireFreeRoot` take adjacent `string` parameters that are easy to swap (carried over from round 2)

**File:** `features/lib/published-marketplace.ts:68-72`, `:111-117`
**Issue:** `publishMarketplaceIn(marketplacesRoot, directory, name, kind, plugins)` type-checks with `directory` and `name` swapped. The new `requireFreeRoot(marketplacesRoot, directory, kind)` adds a second call site of the same shape. The calls at `add.steps.ts:57,60` and `publishing.steps.ts:33` are correct.
**Fix:** Take `{ directory, name }` as an options object in `publishMarketplaceIn`.

### IN-03: The two ADD-06 steps use `directory` for different things (carried over from round 2)

**File:** `features/step_definitions/marketplace/add.steps.ts:66-83`
**Issue:** The same `<directory>` column feeds both steps. In `... to add does not exist`, the parameter `directory` is the directory *name*. In `... to add holds no marketplace manifest`, the parameter is `name`, and `directory` is the joined *path*.
**Fix:** In both steps, name the parameter `directory` and the joined path `root`. This also matches `requireFreeRoot`.

### IN-04: The remove feature description claims more than its one scenario observes (carried over from round 2)

**File:** `features/marketplace/remove.feature:3-5`
**Issue:** The description says that removal drops the marketplace "with its declaration and the plugins installed from it". The one scenario observes the two config files and the result row. It does not observe the scope's record or any plugin cascade. The title is narrow enough that the title itself does not pass falsely.
**Fix:** Phase 4 (D-07) extends this file. Until it does, narrow the description to what the file shows: "Removing a marketplace drops it from a scope and from the configuration file that declares it."

### IN-05: Leftovers after the round-2 fixes

**File:** `features/step_definitions/marketplace/add.steps.ts:25-31`; `features/lib/published-marketplace.ts:63-89`, `:118`
**Issue:**
- `breakManifest` is still a one-line wrapper around `invalidateManifest(name, world.requirePublished(name), problem)`. The shared `has become invalid` step calls the same function inline (`publishing.steps.ts:149`).
- The rule that a marketplace lives in `marketplacesRoot/<directory>` is now joined in two library functions: `requireFreeRoot` (`:76`) and `publishMarketplaceIn` (`:118`). The step deletes the path from the first function and the fixture writes to the path from the second. Today they agree. When a kind gives them different roots, the release deletes a path that the publish never wrote.
- `requireFreeRoot` says that it fails "when a marketplace is published there already", and its message says `<directory> already holds a marketplace`. It actually rejects any entry at that path, including the manifest-less directory that ADD-06 creates.

**Fix:** Inline `breakManifest`. Have `publishMarketplaceIn` take the root that `requireFreeRoot` returned, or compute the root in one private helper that both functions call. Change the message to `${directory} is already taken`.

### IN-06: The ADD-06 comment borrows a rationale that does not apply to ADD-06

**File:** `features/step_definitions/marketplace/add.steps.ts:64-65`
**Issue:** "One literal text per directory state, for the reason given above the manifest problems." The reason above is that a misspelled variant fails the feature gate "even in a row the default profile excludes". The ADD-06 Outline has no tagged block, so it has no excluded rows. A parameterized step would also fail on a misspelling, in `npm run test:cucumber`. The two directory states are separate steps because they do different things: one only asserts absence, and the other creates a directory. The comment also locates its reason by position in the file ("given above"), so moving either group breaks the reference.
**Fix:** Give the true reason, or drop the comment, because two steps with different bodies need none:

```ts
// One step per directory state: one asserts that the directory is absent,
// and the other creates it without a manifest.
```

### IN-07: The ADD-04 copy is identical to the first marketplace in everything but its location

**File:** `features/step_definitions/marketplace/add.steps.ts:60`; `features/marketplace/add.feature:148`
**Issue:** The copy declares the same name, the same owner, and the same empty plugin list, so its `marketplace.json` matches the first one byte for byte. The title says that the add fails because the *name* is already held. Row 2 tells name-keyed detection apart from source-keyed detection (D-01). It does not tell name-keyed detection apart from content-keyed detection, such as deduplicating by a hash of the manifest. An implementation like that is unlikely, so this is not a BLOCKER. But nothing in the scenario pins that the name alone decides.
**Fix:** Make the copy differ in something other than its name. For example, pass one offered plugin to `publishMarketplaceIn` instead of `[]`. Then only the shared name can explain the failure.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
