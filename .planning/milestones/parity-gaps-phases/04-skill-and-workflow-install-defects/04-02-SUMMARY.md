---
phase: 04-skill-and-workflow-install-defects
plan: "02"
subsystem: orchestrators/plugin/info (skill listing), cucumber skill features
status: complete
tags: [PG-CORE-01, D-PG4-01, skills, info, cucumber]
requires:
  - "04-01: isMarketplaceRootSource and the strict root-source skills branch"
provides:
  - "componentNamesFromEntries in info.ts: a skills path that holds a regular SKILL.md lists as one skill named by its folder"
  - "rootSourceLenientSkillPaths and containedRelativePath in info.ts: the lexical D-PG4-01 mirror for the unavailable arm"
  - "Two info scenarios in features/skill/root-source-entries.feature (9 scenarios in total)"
affects:
  - "04-06 (edits info.ts after this plan for the PG-SEC-01 note)"
tech-stack:
  added: []
  patterns:
    - "Per-path name derivation from the entries already read, no extra directory read"
    - "Lexical containment test (path.isAbsolute plus path.relative) before a lenient path reaches the reader"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - test/orchestrators/plugin/info.test.ts
    - features/skill/root-source-entries.feature
    - .fallowrc.json
decisions:
  - "The lenient root-source branch stores the normalized relative form of each kept path (skills/a, ., skills), so de-duplication and the skills-folder rule compare one spelling"
  - "The NamedComponentKind alias replaces the three repeated kind unions in info.ts (sonarjs/use-type-alias)"
metrics:
  duration: "~35 min"
  completed: 2026-11-13
estimate:
  tokens: 46000
  tasks: 2
actuals:
  tokens: 11600
  tasks: 2
  commits: 2
plan_head_before: cf9383f572b9a429d2e45a1284ebc69854977b7e
plan_head_after: 6fdccd085a9c1d6ae8d7e8e02cb03b5d8105783c
---

# Phase 4 Plan 02: Info lists what a root-source entry installs Summary

`/claude:plugin info` now lists a root-source entry's skills by the rule install uses (D-PG4-01). When a listed skills folder holds a regular `SKILL.md`, info lists it as one skill and does not list its subfolders. The lenient listing for a plugin that the resolver refuses follows the same rule, and it never reads an absolute or escaping listed path.

## What changed

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`
  - New `componentNamesFromEntries(abs, entries, kind)`. For `skills`, when the entries already read for a path hold a regular file `SKILL.md` (`Dirent.isFile()`, so a directory or a link does not count), the path is one skill named `path.basename(abs)`. Otherwise every entry goes through the unchanged `nameFromEntry`. `discoverComponentNames` calls it per path, keeps its reasoned `no-await-in-loop` disable, and its doc comment cites D-PG4-01. No directory read was added.
  - New `NamedComponentKind` type alias for `"skills" | "commands" | "agents"`. The new helper made the union appear three times, and the commit hook's `sonarjs/use-type-alias` failed (see Deviations).
  - New `rootSourceLenientSkillPaths(entry)`. It applies when `isMarketplaceRootSource(entry.source)` holds (imported from `domain/component-paths.ts`, with no second copy of the predicate) and `asDeclaredList(entry.skills)` holds at least one string. The kept paths are the listed strings that `containedRelativePath` accepts, in listed order and de-duplicated. `skills` is appended only when `.` is kept and `skills` is not already kept. When no string is kept, the list is empty. Otherwise the function returns `undefined`, and `deriveLenientComponentPaths` runs today's rule. The doc comment of `deriveLenientComponentPaths` names the exception.
  - New `containedRelativePath(declared)`. It returns `undefined` for an absolute path (`path.isAbsolute`) or one whose `path.relative(".", declared)` is `..` or starts with `../`. It returns `.` for the root. The test is lexical and reads no file.
- `.fallowrc.json`: the `ignoreExports` block that 04-01 added for `isMarketplaceRootSource` is removed. It held only that entry, so the whole key goes, and the file is byte-identical to its state before 04-01 (`git diff f2b48edc~1 -- .fallowrc.json` is empty). After the removal, `npx fallow dead-code --fail-on-issues --quiet`, `npx fallow dupes --fail-on-issues --quiet`, and `npx fallow health --fail-on-issues --quiet` each exit 0. WINDOWS ledger #116 is closed with `gsd-tools windows fixed 116` (status `fixed`, 2026-11-14T04:26:15Z).

## Scenarios (features/skill/root-source-entries.feature)

8. Info on a root-source entry that lists skills lists only the listed skills (task 1)
9. Info on a root-source entry with an escaping listed path lists only the listed skills inside the plugin (task 2)

Each scenario's Then states all 13 fields of the result, in the shape of `features/plugin/component-directories.feature`. No step, library, or support module changed.

The unavailable row in scenario 9 shows `plugin status` `unavailable` and `plugin reasons` `unsupported source`, the narrowed form of the escape refusal note. I read both values from the first red run. `plugin components resolved` is `true` and `plugin components skills` is `a`.

## Red and green evidence

All runs: `npm run test:cucumber:profile -- --profile adapter features/skill/root-source-entries.feature`, Node v26.13.1.

- **Task 1 red** (tree at cf9383f5, as 04-01 left it, plus the new scenario): `8 scenarios (7 passed, 1 failed)`, `112 steps (111 passed, 1 failed)`. `plugin components skills` read `references`, and `a` was expected. Every other field matched.
- **Task 1 green** (after the `componentNamesFromEntries` change): `8 scenarios (8 passed)`, `112 steps (112 passed)`.
- **Task 2 red** (tree after task 1's commit 8b482009, plus the new scenario): `9 scenarios (8 passed, 1 failed)`, `122 steps (121 passed, 1 failed)`. `plugin components skills` read `a, b`, and `a` was expected. The first draft also expected empty reasons, and the run showed `unsupported source`, so the scenario now states that value.
- **Task 2 green** (after the lenient branch): exit 0, `9 scenarios (9 passed)`, `122 steps (122 passed)`.

Owner and coverage commands, after each task:

- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/info.test.ts`: 273 of 273 pass after task 1, 280 of 280 after task 2. Every case that existed before passes with its expectations unedited, including the commands, agents, and D-64-05 lenient cases.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`: exit 0 after each task, so the file has 100% direct coverage.
- The commit hook (`npm run check:commit`) passed for both commits.
- Not run: the full `npm run check`. The orchestrator runs it after the wave.

## Owner cases added (test/orchestrators/plugin/info.test.ts)

Task 1 (whole-message assertions):
- a listed skill folder that holds `SKILL.md` is one skill, not its subfolders (`skills: a`)
- a skill reached as a listed folder and through its parent lists once, sorted without case sensitivity (`skills: alpha, Zeta`)
- a `SKILL.md` directory does not make its folder one skill (`skills: references, SKILL.md`)
- a `SKILL.md` link does not make its folder one skill (`skills: references`)

Task 2 (each one records every `listDirectory` call, relative to the marketplace root, beside a skill folder at `../outside` and one under an absolute path, so a read of either one would show):
- listed paths inside the plugin only, in listed order, once each. The calls are `agents, commands, skills/c, skills/a`. The absolute path, `../outside`, and the duplicate `skills/c/` are never read (T-04-03).
- `.` listed first: `skills` is appended after the kept paths
- `./skills/` and `.` listed: `skills` is read once
- every listed path absolute or escaping: no skills line, and only `agents, commands` are read
- a root-source entry that lists no string (`[42]`): today's rule
- a root-source entry with no `skills` (unavailable because of malformed `hooks/hooks.json`): today's rule
- a non-root string source: today's rule, unchanged (it still reads `../x`, which is the existing lenient join that this plan does not widen)

## Commits

- `8b482009` fix(skills): list a listed skill folder as one skill in info
- `6fdccd08` fix(skills): apply the root-source skill rule to the lenient info list

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] sonarjs/use-type-alias on the repeated kind union**
- **Found during:** the first commit attempt for task 1. The hook's lint failed at `info.ts:333`: `Replace this union type with a type alias`. The new helper made `"skills" | "commands" | "agents"` appear three times.
- **Fix:** a module-private `type NamedComponentKind`, used by `nameFromEntry`, `componentNamesFromEntries`, and `discoverComponentNames`. Behavior is unchanged.
- **Commit:** 8b482009

**2. [Extra duty] fallow exemption removed in the consumer's commit**
- The orchestrator asked for this. The `.fallowrc.json` `ignoreExports` block from 04-01 is removed in commit 6fdccd08, the same commit that adds the `info.ts` import. WINDOWS #116 is closed as `fixed`.

**3. [Plan reading] lenient fallback when no listed path exists**
- The strict rule falls back to D-CF1-06 when no listed path survives and none was a traversal, for example when the listed folder does not exist. The lenient mirror is lexical and has no stat, so it keeps a missing listed path. The reader then gets ENOENT and lists nothing for that path, as the plan specifies. This only affects unavailable rows.

No other deviation. The object-form source arm is not tested in `info.test.ts`: `info` does not resolve components for a non-path source, and the `isMarketplaceRootSource` owner cases in `test/domain/component-paths.test.ts` already prove that an object source is not root-source.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-03 is mitigated. The root-source branch drops absolute and escaping listed strings before any read, and the recording-reader owner cases prove the reader never receives one. The existing lenient join for non-root entries is unchanged and not widened. T-04-SC: no package was installed.

## Parent lines

- PROJECT.md: none beyond 04-01's D-CF1-06 amendment. `info` now reports the skill set that amendment describes.
- BACKLOG.md: none.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts (`isMarketplaceRootSource` x2, `D-PG4-01` x4)
- FOUND: features/skill/root-source-entries.feature (9 `Scenario`, 2 `plugin components skills`)
- FOUND: 8b482009, 6fdccd08 (ancestors of HEAD)
- `function isMarketplaceRootSource` is defined only in domain/component-paths.ts
