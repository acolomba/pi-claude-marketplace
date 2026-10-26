---
phase: 03-marketplace-add
reviewed: 2026-10-16T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - features/lib/path-marketplace.ts
  - features/lib/published-marketplace.ts
  - features/marketplace/add.feature
  - features/marketplace/remove.feature
  - features/step_definitions/marketplace/add.steps.ts
  - features/step_definitions/marketplace/publishing.steps.ts
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-16
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

I reviewed the phase diff (`6e1cf1fb..HEAD`) of the six files. I checked them against the cucumber skill and its four rules files, the typescript-style comment rules, and `03-CONTEXT.md` (D-01..D-09). Gate results on this tree:

- `npm run test:cucumber`: 41 scenarios passed, 324 steps passed.
- `npm run check:features`: exit 0.
- `eslint --max-warnings 0` on the four `.ts` files: exit 0.
- `fallow dupes`: no clone group in `features/`.

The core scenarios hold up against the main wrong implementations:

- The duplicate-name Outline (ADD-04) catches a check that compares sources instead of names. It also catches a wrong subject name and an add that overwrites the record.
- The `~/` row of ADD-06 catches a subject named by the resolved path instead of the path as typed.
- The `--local` add and remove scenarios seed a base file, so a write to the wrong file is caught in both directions.

Findings:

- **Fail-clean gap.** The ADD-06 and ADD-07 failure scenarios never check that the failed add left nothing behind.
- **Outline readability.** Several Outline rows run a `Given` that has nothing to do with them, or rely on a precondition no step states.
- **Latent fixture bug.** `invalidateManifest` rebuilds the fixture path from the name, but the new `publishMarketplaceIn` lets the directory differ from the name.
- **Duplicated helper.** `add.steps.ts` re-implements `requirePublished`.
- **Colliding decision IDs.** D-01 and D-04 now mean two different decisions in the same suite, and D-04 does so within one file.

No finding is a BLOCKER. Every scenario fully proves the behavior its title claims.

## Warnings

### WR-01: The ADD-06 and ADD-07 failures do not check that the failed add leaves nothing behind

**File:** `features/marketplace/add.feature:176-219`
**Issue:** "Source missing" and "invalid manifest" compare only the envelope and the failed row. Neither scenario checks what persists after the failure.

Here is a plausible regression that both scenarios pass: the add writes the `claude-plugins.json` entry (or the state record) for the typed source, then fails on the manifest read or the schema check without rolling back. That breaks NFR-3, which requires fail-clean behavior.

D-05 accepts this gap because "these failures throw before anything is written, inside the locked transaction". That reason relies on how the code works today, which is exactly what a behavioral test should not assume. The duplicate-name Outline right above these scenarios does check persistence (D-02), so the three failure scenarios in this file are inconsistent with each other. D-05 is a locked decision, so this is a WARNING for the operator to weigh, not a BLOCKER.
**Fix:** Seed the project scope's base file, as ADD-13 does (D-06), and check that it is unchanged after the failure:
```gherkin
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "extras" is added to the project scope
    ...
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name   | source                     |
      | extras | {home}/marketplaces/extras |
```
For ADD-07, the extra Given needs a marketplace name other than `tools`, so it does not collide with the broken one.

### WR-02: Outline rows run setup that has nothing to do with them, and rely on preconditions no step states

**File:** `features/marketplace/add.feature:177`, `:189-193`, `:151`, `:167`
**Issue:**

- **ADD-06, the `empty` Given.** `Given the directory "empty" to add holds no marketplace manifest` runs in all four rows, but only the `{home}/marketplaces/empty` row uses it.
- **ADD-06, the `missing` rows.** The other three rows depend on `{home}/marketplaces/missing` not existing. No step states that. It holds only because the `Before()` hook in `support/pi-process.ts` empties HOME. A reader who looks only at the scenario sees a `Given` about `empty` and a source about `missing`, and has to open the support code to see why the `missing` rows fail.
- **ADD-04, row 1.** `Given another marketplace named "tools" ... in "tools-copy"` runs in row 1 (`second source` = `{home}/marketplaces/tools`), which never uses `tools-copy`.

These break the rule that a reader must understand each scenario without opening a step definition.
**Fix:** Either of these works:

- Give ADD-06 a `<directory>` column and a Given that states the precondition for every row, such as `Given the directory "<directory>" to add holds no marketplace manifest`, with `missing` for the three `missing` rows. The step then creates nothing for a directory that must not exist. Instead, it asserts `ENOENT` on the directory itself.
- Split each Outline into the variants it combines, as D-01 already names them for ADD-04: "the same source twice" and "another directory declaring the same name".

### WR-03: `invalidateManifest` rebuilds the fixture path from the name and ignores how the marketplace was published

**File:** `features/lib/published-marketplace.ts:203-218` (line 212)
**Issue:** This phase adds `publishMarketplaceIn`, which lets a marketplace's directory differ from its manifest name. `invalidateManifest` still writes to `path.join(marketplacesRoot, name)`.

The `published` record it receives is ignored for the path. Its `source` is the published directory, or the manifest path for the file kind. Suppose a later scenario records a marketplace published through `publishMarketplaceIn`, with directory ≠ name, and then breaks its manifest. The function creates a new manifest under `marketplaces/<name>/` and leaves the published one intact. The scenario then adds a valid marketplace and fails, or passes, for the wrong reason.

No path reaches this today, because the `another marketplace ... in {string}` step does not record what it publishes. But the two helpers now disagree about where a marketplace lives. The size-uniqueness argument that the manifest cache depends on (the doc comment of `writeMalformedManifest`) also assumes that one path only ever holds manifests of one name.
**Fix:** Carry the root on the record and use it:
```ts
export interface PublishedMarketplace {
  readonly kind: SourceKind;
  readonly root: string;
  readonly source: string;
}
// publishMarketplaceIn: return { kind, root, source: ... }
// invalidateManifest:
case "dir":
case "file":
  await MANIFEST_WRITERS[problem](published.root, name);
  return;
```
Then drop the `marketplacesRoot` parameter from `invalidateManifest`.

### WR-04: `add.steps.ts` re-implements `requirePublished` from `publishing.steps.ts`

**File:** `features/step_definitions/marketplace/add.steps.ts:21-32`; `features/step_definitions/marketplace/publishing.steps.ts:14-21`
**Issue:** `breakManifest` repeats the look-up-or-`assert.fail` logic of `requirePublished`, message included. `layout.md` says: "A small helper private to one step module may stay in it; once a second module needs it ... it moves to `features/lib/`." Because the two copies now exist side by side, a change to one (for example, a better failure message or a different source of truth) silently misses the other.
**Fix:** Move the logic into one place. The simplest home is a world method, since both copies read the world's published map:
```ts
// features/support/world.ts
/** Returns how this scenario published the marketplace `name`, failing when it did not. */
requirePublished(name: string): PublishedMarketplace {
  const published = this.published.get(name);
  if (published === undefined) {
    assert.fail(`the marketplace ${name} is not published in this scenario`);
  }
  return published;
}
```
A function in `features/lib/` that takes the world also works. Then delete both private copies.

### WR-05: Decision IDs D-01 and D-04 now mean two different decisions in the suite, and D-04 does so within one file

**File:** `features/lib/published-marketplace.ts:5`, `:60`, `:75`, `:101`; `features/step_definitions/marketplace/add.steps.ts:36`, `:56`
**Issue:** The suite already uses D-01 and D-04 from `01-CONTEXT.md`:

- D-01 is "a `kind` row in every result" (`command.steps.ts:38`).
- D-04 is "fixtures under `{home}/marketplaces/<name>`" (`pi-process.ts:61`, `published-marketplace.ts:5` and `:60`).

This phase adds comments that cite D-01 and D-04 from `03-CONTEXT.md` instead:

- D-01 as the duplicate-name design (`add.steps.ts:56`, `published-marketplace.ts:75`).
- D-04 as the malformed-manifest fixture (`add.steps.ts:36`, `published-marketplace.ts:75`, `:101`).

In `published-marketplace.ts`, "D-04" now means the HOME fixtures at lines 5 and 60 and the malformed-JSON fixture at lines 75 and 101. Per-phase numbering restarts in each context file. This is the same hazard that the comments rule bans for bare `Pitfall N`: the anchor no longer identifies a single decision. `add.steps.ts:7` already qualifies its own citation ("D-08 in `.agents/skills/cucumber/rules/layout.md`"), which shows the problem was noticed for one ID but not the others.
**Fix:** Phase-qualify the new citations (`D-03-01`, `D-03-04`, in the `D-54-01` form the comments rule lists), or cite the requirement row instead (`ADD-04`, `ADD-07`), which is stable across phases.

### WR-06: The "another marketplace" Given does not assert that its setup leaves the first marketplace intact

**File:** `features/step_definitions/marketplace/add.steps.ts:50-58`
**Issue:** The step writes a manifest named `name` into `directory` without checking that the directory is free. Suppose a scenario writes `in "tools"`, the directory of the marketplace that is already published. The step then silently overwrites that marketplace's manifest. With no plugins, the content is identical, so nothing shows. If the first marketplace offered plugins, its plugin list is wiped. Either way, the step registers a second release of the same root.

The rule in `steps.md` says: "A `Given` that performs setup asserts that the setup succeeded, so a broken precondition fails in the `Given` and not in a later `Then`." Here a wrong precondition either passes silently or fails in a later `Then`.
**Fix:** Assert the directory does not exist before publishing into it:
```ts
const root = path.join(this.marketplacesRoot, directory);
await assert.rejects(stat(root), { code: "ENOENT" }, `${directory} already holds a marketplace`);
this.onRelease(() => rm(root, { recursive: true, force: true }));
await publishMarketplaceIn(this.marketplacesRoot, directory, name, kind, []);
```

## Info

### IN-01: The doc comment of `publishMarketplaceIn` describes behavior the function does not have

**File:** `features/lib/published-marketplace.ts:71-76`
**Issue:** "For a git kind, `directory` is the repository its stand-in serves." Both git kinds throw `noStandIn` today. The comments rule says a comment describes the code as it stands.
**Fix:** Drop that sentence, or restate it as a fact: "The url and github kinds throw until they have a stand-in."

### IN-02: `publishMarketplaceIn` takes two adjacent `string` parameters that are easy to swap

**File:** `features/lib/published-marketplace.ts:77-83`
**Issue:** `(marketplacesRoot, directory, name, kind, plugins)`: swapping `directory` and `name` still type-checks. It would publish a manifest declaring `tools-copy` in the directory `tools`, and the duplicate-name scenario would then fail for a confusing reason. The one call site (`add.steps.ts:57`) is correct today.
**Fix:** Take an options object, `{ directory, name }`, or put `directory` last with a default of `name`.

### IN-03: The step text does not say what `in {string}` names, and the parameter names do not match their values

**File:** `features/step_definitions/marketplace/add.steps.ts:50-51`, `:60-62`; `features/marketplace/add.feature:151`
**Issue:**

- `... is published as a dir source in "tools-copy"` does not say that `tools-copy` is a directory. A reader has to infer it from the `second source` column.
- In the step `the directory {string} to add holds no marketplace manifest`, the parameter is named `name` but holds a directory name, and the local `directory` holds a path.

**Fix:** Write `... source in the directory "tools-copy"`, and rename the parameter to `directoryName` (or the local to `root`).

### IN-04: The remove feature's description claims more than its only scenario proves

**File:** `features/marketplace/remove.feature:3-5`
**Issue:** The description says removal drops the marketplace "with its declaration and the plugins installed from it". The one scenario installs no plugins and does not observe the scope's record, for example with a list. Phase 4 is planned to extend this file (D-07), so this is a reminder rather than a defect.
**Fix:** Either keep the description and make sure Phase 4 adds the plugin-cascade scenario, or narrow the description until it does.

### IN-05: The duplicate-name Outline has no `file` rows

**File:** `features/marketplace/add.feature:165-168`
**Issue:** The untagged block holds only `dir` rows. Adding the same manifest path twice (the `file` kind) goes through the same name check, but no row pins it. D-01 chose a dir row and an `@url` row per variant, so this is a coverage note, not a rule violation.
**Fix:** Optionally add `| file | {home}/marketplaces/tools/.claude-plugin/marketplace.json | {home}/marketplaces/tools-copy/.claude-plugin/marketplace.json |` and the same-path variant.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
