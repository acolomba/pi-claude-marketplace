---
phase: 03-slash-commands
plan: 04
subsystem: bridges/commands
tags: [commands, component-paths, info, manifest, cucumber]

requires:
  - phase: 03-slash-commands
    provides: "plan 03-01: the staged-command writer and the shared slash-command steps (command-file Given, listing Then)"
provides:
  - "The declared-file branch of command discovery: a declared `.md` file is one command named from its basename; any other declared file or a symlink is skipped with a warning (D-CF3-05)"
  - "The commands arm of strict component-path collection: `commands/` is read unless `plugin.json` declares `commands`; entry paths add to it, in the order folder, plugin.json, entry (D-CF3-04)"
  - "The lenient `info` mirror for an unavailable plugin: `commands/` is listed beside the entry's declared commands path"
  - "features/slash-command/manifest-forms.feature with seven scenarios (declared file, entry adds, no note, FG-14 replace pin, info mirror, array form, non-markdown warning)"
affects: [03-08 object-map commands, phase 4 agents, phase 7 workflows]

actuals:
  tokens: 11533
  tasks: 3
  commits: 3

plan_head_before: 0ab69e590d8119ba4541225ae06d9899616dcd37
plan_head_after: af02de03e7f3d17aa093ec6625581c5258374ea6

tech-stack:
  added: []
  patterns:
    - "Each declared commands path is classified once with lstat before anything reads it"
    - "The commands kind has its own strict collection function; agents, workflows, and skills keep the shared D-CF1-06 path"

key-files:
  created:
    - features/slash-command/manifest-forms.feature
  modified:
    - extensions/pi-claude-marketplace/bridges/commands/discover.ts
    - extensions/pi-claude-marketplace/domain/component-paths.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - test/bridges/commands/discover.test.ts
    - test/domain/component-paths.test.ts
    - test/orchestrators/plugin/info.test.ts

key-decisions:
  - "A declared non-directory path is refused in this order: symlink, not a regular file, dotfile, not `.md`. The warning reads `declared command path \"<rel>\" in \"<pluginRoot>\" <reason>; skipping path.`"
  - "lstat errors other than ENOENT and ENOTDIR propagate as install failures, as the base readdir did before"
  - "`collectStrictCommandPaths` shares three small helpers with the other kinds (`addValidatedComponentPaths`, `recordShadowedFolder`, `markSupportedWhenCollected`), so the two collectors are not clones"

patterns-established:
  - "A declared commands path either yields commands, yields a warning that names it, or is missing; none is dropped silently while it exists"

requirements-completed: [CMD-04]

coverage:
  - id: D1
    description: "A command file a plugin declares by path installs as one command named from its basename; other declared files are skipped with a warning"
    requirement: CMD-04
    verification:
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#A command file the plugin manifest declares by its path is listed under its file name"
        status: pass
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#Command files and directories a manifest declares in one array are all listed"
        status: pass
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#A declared commands path that names a file other than a markdown file is skipped with a warning"
        status: pass
      - kind: unit
        ref: "test/bridges/commands/discover.test.ts#D-CF3-05 skips each declared path that is not a command file with a warning naming it"
        status: pass
    human_judgment: false
  - id: D2
    description: "A marketplace entry's commands adds to commands/ with no note; plugin.json commands still replaces it with the note"
    requirement: CMD-04
    verification:
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#A commands path a marketplace entry declares adds to the commands folder"
        status: pass
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#Installing a plugin whose marketplace entry declares a commands path reports no folder note"
        status: pass
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#A commands path the plugin manifest declares replaces the commands folder"
        status: pass
      - kind: unit
        ref: "test/domain/component-paths.test.ts (D-CF3-04 folder-rule rows)"
        status: pass
    human_judgment: false
  - id: D3
    description: "info of an unavailable plugin lists commands/ beside the entry's declared commands path"
    requirement: CMD-04
    verification:
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#The plugin info of an unavailable plugin lists the commands folder beside the commands path its entry declares"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/info.test.ts#D-CF3-04: the lenient component map lists the commands folder beside an entry-declared commands path"
        status: pass
    human_judgment: false

duration: 44min
completed: 2026-11-01
status: complete
---

# Phase 3 Plan 04: Declared command files and entry-declared command folders Summary

**A plugin can now name its command files in `commands`, and a marketplace entry's `commands` adds to the `commands/` folder as Claude Code 2.1.316 does. A `plugin.json` declaration still replaces the folder, and `info` of an unavailable plugin agrees with install.**

## Performance

- **Duration:** about 44 min
- **Started:** 2026-11-01T18:16:07Z
- **Completed:** 2026-11-01T19:00:20Z
- **Tasks:** 3 of 3
- **Files modified:** 7 (1 created, 6 modified)
- **Baseline:** `BASE=0ab69e590d8119ba4541225ae06d9899616dcd37`

## Accomplishments

- `bridges/commands/discover.ts`: `discoverDeclaredPath` reads each declared path's type with `lstat` before anything reads it. A directory goes to the existing walk. A regular `.md` file whose name does not start with a dot is one command, named from its basename through `generatedCommandName` (`cmds/sub/x.md` is `demo:x`). Any other file, and a symlink of any kind, gets a warning that names the path. ENOENT and ENOTDIR stay silent. The found commands go through the same `seenByFile` and `seenByGenerated` rules in declared order.
- `domain/component-paths.ts`: `collectStrictCommandPaths` reads `commands/` first unless `plugin.json` declares `commands` (a truthy value, `[]` included). Then it reads the `plugin.json` paths, then the entry paths, with first-wins dedup. It records `commands` as shadowed only when `plugin.json` declares, the folder exists, and no collected path reaches it. Agents, workflows, and skills go through the old code path. It now uses three shared helpers and behaves the same.
- `orchestrators/plugin/info.ts`: `deriveLenientComponentPaths` pushes `commands` for every entry, as it does for `skills`.
- `features/slash-command/manifest-forms.feature`: seven scenarios.

## Task Commits

1. **Task 1: List a command file a plugin declares by its path, end to end** - `2bf9362` (feat)
2. **Task 2: Read the commands folder beside the commands a marketplace entry declares** - `9d1776e` (feat)
3. **Task 3: Mirror the rule in the plugin info of an unavailable plugin and pin the declared-path forms** - `af02de0` (feat)

Tracer gate (Task 1): `end-of-phase` mode with an automated-only `<verify>`. I re-ran the verify (`node --test` on discover.test.ts, direct coverage of discover.ts, cucumber on manifest-forms and component-directories, `check:features`), and all passed. Then I continued with the expansion tasks.

## Red proofs

**Task 1, before the declared-file branch** (`npx cucumber-js features/slash-command/manifest-forms.feature`):

```text
           -   [
           -     '/demo:a',
           -     'Runs a.'
           -   ]
             ]
1 scenario (1 failed)
12 steps (11 passed, 1 failed)
```

**Task 2, before the commands collection function** (both entry scenarios fail; the replace pin passes):

```text
Failed scenarios:
  1) Installing a plugin whose marketplace entry declares a commands path reports no folder note # manifest-forms.feature:74
       Then the command reports these results:
           +   [
           +     'diagnostic',
           +     'warning',
           +     'false',
           +     'Plugin "demo" [project] installed; 1 declared component has a note.',
           +     'Default commands/ folder is ignored because the manifest sets "commands"'
           +   ]
  2) A commands path a marketplace entry declares adds to the commands folder # manifest-forms.feature:33
       Given the user has run "/claude:plugin install demo@fixtures --scope project"
           + [ { header: 'Plugin "demo" [project] installed; 1 declared component has a note.',
           +     kind: 'diagnostic',
           +     lines: [ 'Default commands/ folder is ignored because the manifest sets "commands"' ], ... } ]
           - []
```

Scenario 2 fails at the install Given, because that Given rejects the folder note. The plan predicted the listing would show only `/demo:b`, and that is also what the old code would list. The note comes first.

Unit red (`node --test test/domain/component-paths.test.ts`, before the product change): 5 of the new D-CF3-04 rows failed (`an entry-declared commands path adds ...`, `a declared empty commands list in the entry still reads ...`, `manifest and entry commands paths are read in that order ...`, `an entry path that reaches the commands/ folder ...`, `the commands/ folder comes before an entry path that names it again`).

**Task 3, info mirror** (temporary revert of the `kind === "commands"` arm in `deriveLenientComponentPaths`):

```text
           +     'b'
           -     'a, b'
1 scenario (1 failed)
```

Unit red for the same rule: `commands: b` was listed where `commands: a, b` was expected.

**Task 3, array form and non-markdown warning** (temporary revert of `discover.ts` to `$BASE`, restored from a scratch copy afterwards):

```text
  1) A declared commands path that names a file other than a markdown file is skipped with a warning
           -   [ 'diagnostic', 'warning', 'false',
           -     'Plugin "demo" [project] installed; 1 declared component has a note.',
           -     'declared command path "cmds/readme.txt" in "demo" is not a markdown file; skipping path.' ]
  2) Command files and directories a manifest declares in one array are all listed
           -     '/demo:a',
           -     'Runs a.'
2 scenarios (2 failed)
```

## Negative edit (FG-14 replace pin)

Temporary edit in `collectStrictCommandPaths`: read the folder whenever it exists (`if (folderExists)`) and never record it as shadowed. That applies the entry rule to `plugin.json` too. The pin "A commands path the plugin manifest declares replaces the commands folder" failed:

```text
  1) A commands path the plugin manifest declares replaces the commands folder # manifest-forms.feature:106
       Then the command reports these results:
           -   [ 'diagnostic', 'warning', 'false',
           -     'Plugin "demo" [project] installed; 1 declared component has a note.',
           -     'Default commands/ folder is ignored because the manifest sets "commands"' ]
1 scenario (1 failed)
15 steps (10 passed, 4 skipped, 1 failed)
```

Reverted from a scratch copy before committing. With the product code, the pin passes and lists `/demo:hello` alone.

## Non-owned test edits

None. All three test files are in this plan's `files_modified`.

- `git diff "$BASE"..HEAD -- test/domain/plugin-resolver.test.ts` prints nothing. No resolver case pinned the old entry rule for commands, and `node --test test/domain/plugin-resolver.test.ts` passes unchanged.
- `test/bridges/commands/discover.test.ts` (owned): the two filesystem-race cases count completed fs requests to time their rename. The new `lstat` of each declared path adds one request first, so their trigger counts went from 1 to 2 and from 2 to 3. The asserted errors are unchanged.
- `test/domain/component-paths.test.ts` (owned): the folder table now takes a `declared: { entry?, manifest? }` pair in place of `declaredIn`/`value`. `REPLACE_KINDS` holds agents and workflows. Commands has its own D-CF3-04 rows.
- `git diff --stat "$BASE"..HEAD -- features/plugin` prints nothing.

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/commands/discover.ts` - declared-path classification and the declared-file command (D-CF3-05)
- `extensions/pi-claude-marketplace/domain/component-paths.ts` - `collectStrictCommandPaths` and the three shared helpers (D-CF3-04)
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - the commands arm of `deriveLenientComponentPaths`
- `test/bridges/commands/discover.test.ts` - six D-CF3-05 cases; race counters shifted
- `test/domain/component-paths.test.ts` - restructured folder table with nine D-CF3-04 rows
- `test/orchestrators/plugin/info.test.ts` - one D-CF3-04 lenient case (commands adds, agents replaces)
- `features/slash-command/manifest-forms.feature` - seven scenarios

## Decisions Made

- **Refusal order.** A declared non-directory is checked for symlink, then for a non-regular file, then for a dotfile, then for a non-`.md` name. A dotfile symlink therefore reports "is a symlink".
- **Duplicate warning for a declared file.** The existing `duplicateWarning` names the declared path as the place the losing source lives, so a second `a.md` reads `command source "a" in "<root>/other/a.md" ...`. I kept the walk's wording and did not add a file-specific variant.
- **Name errors.** A declared file whose basename fails RN-2 gets the walk's `badNameWarning`, with the file's directory as the base.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The FG-14 pin cannot use the install Given**
- **Found during:** Task 2
- **Issue:** `Given the user has run "..."` fails when a result is not info. The replace pin's install always emits the folder note, and that note is correct behavior.
- **Fix:** The pin runs `When the user runs` the install, then `Then the command reports these results:` (cascade and note), then `Then the results list these marketplaces and plugins:`, then `When the user starts a new pi session`, the listing `When`, and the listing `Then`. The rules allow `When` and `Then` to alternate.
- **Files modified:** `features/slash-command/manifest-forms.feature`
- **Committed in:** `9d1776e`

**2. [Rule 3 - Blocking] Race-test counters in the owned discover test**
- **Found during:** Task 1
- **Issue:** The extra `lstat` moved the fs request the race cases hook into.
- **Fix:** Their counters went up by one. The expected errors did not change.
- **Committed in:** `2bf9362`

**3. [Rule 1 - Observed] The redacted path in the non-markdown warning is the plugin's basename**
- **Found during:** Task 3
- **Issue:** The plan expected `[redacted path]`. `redactAbsolutePaths` cuts the plugin root to its basename instead, so the row reads `... in "demo" is not a markdown file; skipping path.`
- **Fix:** The scenario states the line as the product renders it.
- **Committed in:** `af02de0`

---

**Total deviations:** 3 (2 blocking, 1 observed wording). **Impact:** none on scope.

## Issues Encountered

- `"skills": 42` makes the plugin unavailable with the reason `unsupported source`. That is the existing reason label for a structural refusal, and I pinned it as observed.
- Inside the worktree, the commit hook printed "(no files to check)" for prettier and `check:commit`. So before each commit I ran `npm run check:static`, the owner tests, and direct coverage by hand, and all passed.

## Verification

- `node --test` on `discover.test.ts` (24 pass), `component-paths.test.ts` with `plugin-resolver.test.ts` (250 pass), and `info.test.ts` (240 pass).
- `npm run test:coverage:direct --` for `discover.ts`, `component-paths.ts`, and `info.ts`: no shortfall.
- `TEST_CONCURRENCY=4 npm run test:modules`: pass. `npm run test:unpaired`: pass.
- `npx cucumber-js features/slash-command features/plugin/component-directories.feature features/plugin/staging-warnings.feature features/plugin/info.feature`: 57 scenarios pass.
- `npx cucumber-js features/skill features/plugin/install.feature features/plugin/update.feature`: 135 scenarios pass.
- `npm run check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features): pass after each task. `npm run fallow` and `npx fallow dupes --fail-on-issues --format human --quiet`: exit 0.
- I did not run the full `npm run check` here, because four executors share this machine. The orchestrator's post-merge gate runs it.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-03-13 is mitigated. The branch reads only a regular `.md` file found by `lstat`, and it refuses any symlink or non-regular file (a socket in the unit case) with a warning. The unit cases are "D-CF3-05 skips each declared path that is not a command file with a warning naming it" and "D-CF3-05 propagates a non-tolerated error when a declared path cannot be classified". The resolver's `assertPathInside` still refuses a declared path that passes through a link, so that path never reaches the bridge.

## Dubious Choices

1. **A warning where upstream is silent.** Claude Code silently skips a declared non-`.md` file. D-CF3-05 asks for a warning, and the warning text is new.
2. **CM-2 elision on declared files.** A declared `demo-a.md` in plugin `demo` becomes `demo:a`, because `generatedCommandName` elides the plugin prefix (D-141-01). Upstream names a declared file from its basename and does not elide.
3. **The FG-14 pin has three `When` steps** (install, new session, listing). It proves one behavior but reads longer than the other listing scenarios.
4. **The non-markdown scenario proves the install row and the warning, not the `/demo:a` listing.** The array scenario covers the listing of a declared file.
5. **The duplicate warning for a declared file names the file as the place the source lives** (see Decisions).
6. **`[]` in the entry still reads the folder.** No probe covered `"commands": []` in an entry. It follows from E4 (`Et=!Se.commands&&Me` reads only `plugin.json`).
7. **The "not a regular file" unit case uses a Unix socket** made with `node:net` in the temp folder. It is the only regular-file alternative a test can create without root or `mkfifo`.

## Parent lines

- **Info listing residual:** `info`'s `discoverComponentNames` reads declared directories only. So a declared `.md` file (and, after plan 03-08, an object-map entry) is installed but not listed by `/claude:plugin info`. This plan does not change the shared `discoverComponentNames`.
- **Skills bridge name-clash set (Phase 2 file, not edited):** `bridges/skills/skill-names.ts::commandUpstreamNames` reads each `componentPaths.commands` entry as a directory. A declared command file therefore adds no name to the skill/command clash set. The fix belongs to the owner of `bridges/skills/**`.
- **Agents and workflows:** the entry half of D-CF1-06 still replaces their folders (parent line to Phases 4 and 7, as D-CF3-04 records).
- **CHANGELOG.md (suggested line):** "A plugin's `commands` can now name command files as well as folders, and a marketplace entry's `commands` adds to the `commands/` folder instead of replacing it, as in Claude Code."
- **PROJECT.md Key Decisions:** none.

## Next Phase Readiness

- Plan 03-08 adds the FG-13 object map. It can put a map's `source` paths into `componentPaths.commands`, and `discoverDeclaredPath` already turns a declared file into one command.

## Self-Check: PASSED

- FOUND: `features/slash-command/manifest-forms.feature`, `bridges/commands/discover.ts`, `domain/component-paths.ts`, `orchestrators/plugin/info.ts`
- FOUND commits on this branch: `2bf9362`, `9d1776e`, `af02de0`. `git rev-list --count 0ab69e5..HEAD` = 3
- Acceptance greps: `D-CF3-05` in discover.ts 3 or more; tracer title 1; `D-CF3-04` in component-paths.ts 1 or more; entry-adds title 1; `D-CF3-04` in info.ts 1; `/demo:sub:x` 1; `git diff --stat $BASE..HEAD -- features/plugin` empty

---
*Phase: 03-slash-commands*
*Completed: 2026-11-01*
