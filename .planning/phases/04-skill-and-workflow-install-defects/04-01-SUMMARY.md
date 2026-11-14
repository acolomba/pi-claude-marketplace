---
phase: 04-skill-and-workflow-install-defects
plan: "01"
subsystem: domain/component-paths (strict resolver), cucumber skill features
status: complete
tags: [PG-CORE-01, D-PG4-01, D-PG4-02, D-PG4-03, skills, resolver, cucumber]
requires: []
provides:
  - "isMarketplaceRootSource(source: unknown): boolean, exported from extensions/pi-claude-marketplace/domain/component-paths.ts"
  - "The root-source skills branch of collectStrictComponentPaths (D-PG4-01)"
  - "writePublishedMarketplaceFiles in features/lib/published-marketplace.ts"
  - "Given: the marketplace {string} has the file {string} at its root with this text:"
  - "Then: the installation record of the {word} scope holds these skills of {string}:"
  - "features/skill/root-source-entries.feature (7 scenarios)"
affects:
  - "04-02 (imports isMarketplaceRootSource into info.ts; adds two info scenarios to root-source-entries.feature)"
  - "04-03 (reuses the marketplace-root file step)"
tech-stack:
  added: []
  patterns:
    - "Per-kind early exit in collectStrictComponentKind (root-source skills, shaped like the commands exit)"
    - "Validate once, then pick the arm, so notes and the dirty flag never double"
key-files:
  created:
    - features/skill/root-source-entries.feature
  modified:
    - extensions/pi-claude-marketplace/domain/component-paths.ts
    - test/domain/component-paths.test.ts
    - features/lib/published-marketplace.ts
    - features/step_definitions/marketplace/publishing.steps.ts
    - features/step_definitions/plugin/installation.steps.ts
    - test/domain/version.test.ts
    - .fallowrc.json
decisions:
  - "The isMarketplaceRootSource export is exempted from fallow unused-export through a .fallowrc.json ignoreExports entry until info.ts imports it (04-02); the entry is then removed (WINDOWS #116)"
  - "validateComponentPath refusals carry cause traversal|type; reason strings unchanged"
  - "Listed-path validation uses Promise.all, and statKind runs only on accepted paths (T-04-01)"
metrics:
  duration: "~12 min"
  completed: 2026-11-13
estimate:
  tokens: 62000
  tasks: 2
actuals:
  tokens: 10200
  tasks: 2
  commits: 2
plan_head_before: e739fcfaab8748f2887259f2d87a89583c6719f4
plan_head_after: c4c0a9519dfa510a832a270195c8f0fc4688fb9f
---

# Phase 4 Plan 01: Root-source skill selection Summary

A marketplace entry whose `source` is the marketplace root and which lists `skills` now installs only the listed skill folders that exist, as Claude Code 2.1.323 does (D-PG4-01). Update and reinstall already remove a skill the entry stops listing, and seven scenarios now prove it (D-PG4-02).

## What changed

- `extensions/pi-claude-marketplace/domain/component-paths.ts`
  - New export `isMarketplaceRootSource(source: unknown): boolean`. It is true only for a string whose segments, split on `/` or `\`, are all empty or `.`.
  - `collectStrictComponentKind` has a new early exit for `kind === "skills"`, shaped like the `commands` exit. It applies when the source is the root and `readPathOrArray(entry.skills)` is not empty (`rootSourceListedSkills`). `collectRootSourceSkillPaths` validates every listed path and every manifest path once, in today's order. A listed path survives when validation accepts it and `statKind` answers `dir`.
    - One or more survivors: they are collected in listed order, first one wins. `skills` is added at the end only when `.` survives and the folder exists. No manifest path is collected and no folder is reported as shadowed.
    - No survivor, and a listed path was refused as a traversal: nothing is collected.
    - No survivor and no traversal refusal: the D-CF1-06 collection runs over the stored validations, with no second note.
  - `validateComponentPath` failures carry `cause: "traversal" | "type"`. Every reason string is unchanged. `validateCommandMapEntry` still returns `{ ok: false, reason }`.
  - The doc comments of `conventionalFolderApplies` and `collectStrictComponentPaths` now name the exception.
- `features/lib/published-marketplace.ts`: new `writePublishedMarketplaceFiles(published, files)`. `writePublishedPluginFiles` now delegates to it with `plugins/<plugin>/` prefixed, so there is one `ownedTarget` and `changePublication` path and no clone group.
- `.fallowrc.json`: an `ignoreExports` entry for `isMarketplaceRootSource` (see Deviations).

## New steps (exact text)

- `Given("the marketplace {string} has the file {string} at its root with this text:", ...)` in `features/step_definitions/marketplace/publishing.steps.ts`. It writes through `writePublishedMarketplaceFiles` and asserts the file reads back as the text.
- `Then("the installation record of the {word} scope holds these skills of {string}:", ...)` in `features/step_definitions/plugin/installation.steps.ts`. It reads through `recordedPlugins` and compares a `| skill |` table in record order. It fails when the record holds no such plugin.

## Scenarios (features/skill/root-source-entries.feature)

1. Installing a root-source entry that lists skills stages only the listed skills
2. Two root-source entries that share one skills folder each stage only their own listed skills (D-PG4-03)
3. An update that drops a listed skill removes its staged folder and its record (version 1.0.0 to 1.1.0, Pitfall 4)
4. A reinstall removes a skill that the entry stopped listing under the same version
5. A new session after the update offers only the skill that stays
6. The Claude Code name of a dropped skill reaches the model as typed
7. A second reinstall of a converged root-source plugin changes nothing

## Red and green evidence

All runs: `npm run test:cucumber:profile -- --profile adapter features/skill/root-source-entries.feature`, Node v26.13.1.

- **Task 1 red** (unchanged resolver, tree at e739fcfa plus the fixture writer, the step, and the feature): exit 1, `2 scenarios (2 failed)`, `26 steps (24 passed, 2 failed)`. Scenario 1's staged listing also held `root-b/` and `root-b/SKILL.md`. Scenario 2 also held `one-b/` and `two-a/` rows.
- **Task 1 green** (after the resolver change): exit 0, `2 scenarios (2 passed)`, `26 steps (26 passed)`.
- **Task 2 green** (before neutralizing): exit 0, `7 scenarios (7 passed)`, `101 steps (101 passed)`.
- **Task 2 red** (`rootSourceListedSkills` forced to return `[]` in the working tree only, then restored with `git checkout --`): exit 1, `7 scenarios (7 failed)`, `101 steps (91 passed, 3 skipped, 7 failed)`.
  - update, reinstall, and second-reinstall scenarios: the staged listing also held the `root-b/` rows. The record step is skipped after that.
  - session scenario: it also offered `/skill:root-b | Skill b.`
  - alias scenario: the model received `<skill name="root-b" ...>Skill b body.\n\nARGUMENTS: Ada</skill>`, not `/root:b Ada`.
- **Task 2 green after restore**: exit 0, `7 scenarios (7 passed)`, `101 steps (101 passed)`.

Other verify commands:

- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/component-paths.test.ts`: 109 tests, 109 pass. Every case that existed before passes with its expectations unedited.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/component-paths.ts`: exit 0, 100% direct coverage.
- `npm run check:features`: exit 0, after each task.
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/version.test.ts`: 33 tests, 33 pass. The new case pins `hash-07f61ac8b5da`, then `hash-6b95c2ddc359` after only `.claude-plugin/marketplace.json` changes. With `.claude-plugin` added to `HASH_WALK_SKIP` in the working tree only, the case fails (`actual: 'hash-a39062046393'`). That edit was restored.
- `npx fallow dupes` and `npx fallow health`: exit 0. The commit hook (`npm run check:commit`) passed for both commits.
- Not run: the full `npm run check`. The orchestrator runs it after the wave.

## Commits

- `f2b48edc` fix(skills): install only the listed skills of a root-source entry
- `c4c0a951` test(skills): prove an update or reinstall drops an unlisted skill

Task 2 changed no file under `extensions/pi-claude-marketplace/`. The scenarios found no file or record that stays after an update or a reinstall, so no removal-path fix was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] fallow unused-export on the new predicate**
- **Found during:** Task 1 commit. The hook's `fallow dead-code` failed with `Unused exports: component-paths.ts:512 isMarketplaceRootSource`. Its only consumer, `orchestrators/plugin/info.ts`, lands in plan 04-02, and test imports do not count in production mode.
- **Fix:** an `ignoreExports` entry in `.fallowrc.json` (`{ "file": "extensions/pi-claude-marketplace/domain/component-paths.ts", "exports": ["isMarketplaceRootSource"] }`). It needs no `entry` change. fallow never reports a stale `ignoreExports` name, so 04-02 still passes after it adds the import. Two alternatives were rejected. Dropping `export` breaks the plan's acceptance grep and the direct predicate cases. A `fallow-ignore` marker in `component-paths.ts` would go stale and fail 04-02, which does not own that file.
- **Follow-up:** remove the entry once `info.ts` imports the predicate. WINDOWS ledger #116 tracks it (recorded with phase `4`).
- **Files modified:** `.fallowrc.json`
- **Commit:** f2b48edc

**2. [Rule 3 - Clone avoidance] `writePublishedPluginFiles` delegates to the new writer**
- The plan asked for an analog writer. A second copy would have made a fallow clone group, so the plugin writer now calls `writePublishedMarketplaceFiles` with the `plugins/<plugin>/` prefix. Behavior is unchanged: the same guard, the same publication wrapper, and the same overwrite semantics.
- **Commit:** f2b48edc

No other deviation. Every arm in the behavior list has an owner case that compares the whole `resolution`. One case records the stat reader and proves it received no refused path.

## Flagged assumptions (unchanged, still unverified against upstream)

- **A1:** an entry `skills` of `""` or `null` declares nothing under the root-source rule, as `readPathOrArray` reads it. Claude Code would read `""` as the plugin root. The owner cases "a root-source entry whose skills is null / an empty string applies the D-CF1-06 rule" pin this project's reading.
- **A2:** both an absolute and an escaping listed path count as a traversal (`cause: "traversal"`). Owner cases cover both, and both make the plugin unavailable at install.
- The two "no listed path survives" arms cannot be reached by an install, because any refusal note makes the plugin unavailable. They are proven only by owner cases (Pitfall 3).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-01 is mitigated: `statKind` runs only on paths that `validateComponentPath` accepted, and the owner case "the stat reader receives no refused listed path" proves it. T-04-02 is mitigated by scenarios 3 to 7, with no new write path. T-04-SC: no package was installed.

## Parent lines

- PROJECT.md: amend D-CF1-06 with the D-PG4-01 exception. A root-source entry (string source whose segments are all empty or `.`) that lists `skills` gets only the listed folders that exist. `skills/` stays only when the root is listed, the `plugin.json` skills paths are not read, and no shadowed-folder warning is given (Claude Code 2.1.323). The doc and CHANGELOG corrections belong to later plans of this phase.
- BACKLOG.md: none from this plan.

## Self-Check: PASSED

- FOUND: features/skill/root-source-entries.feature
- FOUND: extensions/pi-claude-marketplace/domain/component-paths.ts (`export function isMarketplaceRootSource`, `D-PG4-01`)
- FOUND: f2b48edc, c4c0a951 (ancestors of HEAD)
