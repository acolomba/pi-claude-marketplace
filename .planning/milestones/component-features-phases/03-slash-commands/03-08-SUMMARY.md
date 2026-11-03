---
phase: 03-slash-commands
plan: 08
subsystem: bridges/commands
tags: [commands, component-paths, object-map, manifest, cucumber]

requires:
  - phase: 03-slash-commands
    provides: "plan 03-01: the staged-command writer; plan 03-02: dropped fields and the terminal-menu steps; plan 03-04: declared command files, `collectStrictCommandPaths`, and the entry-adds rule; plan 03-06: the project ledger in `commitPreparedCommands`"
provides:
  - "The object-map `commands` form (Claude Code's `IKn`): `componentPaths.commandMap` of validated `CommandMapEntry` values, each with its origin"
  - "Map discovery: `source` entries named `<plugin>:<key>`, directory sources walked, inline `content` commands, skip warnings for bad keys, bad sources, repeated files, and entry `content`"
  - "The `DiscoveredCommand` union (`file` | `inline`) with manifest overrides; the writer applies `description` and `argumentHint`, and counts a manifest `model` for the dropped-fields line"
  - "Inline commands record `<plugin root>#commands.<key>` as their source path"
  - "features/slash-command/manifest-forms.feature: 13 new scenarios and outlines (21 new runs)"
affects: [03-09 phase gate, phase 4 agents, phase 7 workflows]

actuals:
  tokens: 29787
  tasks: 3
  commits: 3

plan_head_before: f7fcf84bde8abb17f6f642480ca9836e2327dce5
plan_head_after: 618973b5cc8a3bc3f3aff247d9498ab15fc0317a

tech-stack:
  added: []
  patterns:
    - "A map entry reaches the bridge already validated; the bridge only checks what the filesystem and the naming rules decide"
    - "The writer narrows a file or inline command once, where it reads the source text; every later step is shared"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/resolver-types.ts
    - extensions/pi-claude-marketplace/domain/component-paths.ts
    - extensions/pi-claude-marketplace/bridges/commands/types.ts
    - extensions/pi-claude-marketplace/bridges/commands/discover.ts
    - extensions/pi-claude-marketplace/bridges/commands/staged-command.ts
    - extensions/pi-claude-marketplace/bridges/commands/stage.ts
    - features/slash-command/manifest-forms.feature
    - test/domain/resolver-types.test.ts
    - test/domain/component-paths.test.ts
    - test/bridges/commands/types.test.ts
    - test/bridges/commands/discover.test.ts
    - test/bridges/commands/staged-command.test.ts
    - test/bridges/commands/stage.test.ts
    - test/architecture/declared-component-path-overlap.test.ts

key-decisions:
  - "A map is detected by its first value only (`IKn`); any other object stays a path declaration and keeps the not-a-string refusal"
  - "Every structural refusal of a map entry (type, both or neither of source and content, absolute, escaping, or linked source) is a resolver note, so the plugin is unavailable; the bridge skips with a warning only for key, file, duplicate, and entry-content problems"
  - "Map skip warnings name the key and plugin-relative paths, never the plugin root: the notification layer's path redaction cuts a line short after a quoted absolute path followed by more quotes"
  - "A key's control and format characters are shown as `\\u{XXXX}` in the warning (T-03-25)"
  - "A `plugin.json` map's entries come before a marketplace entry map's; declared paths come before every map entry"

patterns-established:
  - "Object-map entries ride on the optional `componentPaths.commandMap`; `componentPaths.commands` stays a list of strings"

requirements-completed: [CMD-04]

coverage:
  - id: D1
    description: "A plugin.json object map of command files installs each entry as `<plugin>:<key>`; bad keys, bad sources, and a second key on one file are skipped with a warning; a directory source is walked"
    requirement: CMD-04
    verification:
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#A plugin manifest's object map of commands lists each command under its key"
        status: pass
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#A command map key pi cannot name is skipped with a warning"
        status: pass
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#A command map entry whose source pi cannot stage is skipped with a warning"
        status: pass
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#A command map entry whose source is a directory is read as a directory"
        status: pass
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#Two command map keys that name one file keep the first"
        status: pass
      - kind: unit
        ref: "test/bridges/commands/discover.test.ts (D-CF3-03 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Malformed map entries make the plugin unavailable; a plugin.json map replaces commands/ with the note; an entry map adds to it"
    requirement: CMD-04
    verification:
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#A command map entry that names both or neither of source and content makes the plugin unavailable"
        status: pass
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#Installing a plugin whose manifest declares its commands as an object map reports the commands folder it leaves unread"
        status: pass
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#A marketplace entry's object map of commands adds to the commands folder"
        status: pass
      - kind: unit
        ref: "test/domain/component-paths.test.ts (D-CF3-03 and D-CF3-04 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Inline map content installs, lists, and runs; the manifest description, argument hint, and model reach Pi's listing, the terminal menu, and the dropped-fields note; an entry's inline content is dropped with a warning"
    requirement: CMD-04
    verification:
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#A command map entry's inline content is listed with the manifest's description"
        status: pass
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#Inline command content keeps its own frontmatter"
        status: pass
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#Invoking an inline command sends the model its content with the arguments"
        status: pass
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#A command map entry's model is reported as a dropped field"
        status: pass
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#A command map entry's argument hint is shown in pi's terminal menu"
        status: pass
      - kind: e2e
        ref: "features/slash-command/manifest-forms.feature#A marketplace entry's inline command content is dropped with a warning"
        status: pass
      - kind: unit
        ref: "test/bridges/commands/staged-command.test.ts (D-CF3-03, D-CF3-09, D-CF3-10 cases)"
        status: pass
    human_judgment: false

duration: 47min
completed: 2026-11-01
status: complete
---

# Phase 3 Plan 08: Object-map command manifests Summary

**A `commands` object map (Claude Code 2.1.316's `IKn` form) now installs: `source` entries become `<plugin>:<key>` commands, `plugin.json` `content` entries become inline commands, and the manifest's description, argument hint, and model reach Pi's listing, terminal menu, and dropped-fields note. Malformed maps make the plugin unavailable, as upstream's install fails.**

## Performance

- **Duration:** about 47 min
- **Started:** 2026-11-01T20:03Z
- **Completed:** 2026-11-01T20:50Z
- **Tasks:** 3 of 3
- **Files modified:** 14 (0 created)
- **Baseline:** `BASE=f7fcf84bde8abb17f6f642480ca9836e2327dce5`

## Accomplishments

- `domain/resolver-types.ts`: `ComponentPathsSchema` gains the optional `commandMap`, an array of `CommandMapEntry` (`key`, `source` or `content`, optional `description`, `argumentHint`, `model`, and `origin` `manifest` or `entry`). `CommandMapEntry` is exported, derived from `MaterializablePlugin`.
- `domain/component-paths.ts` (commands arm only): `isCommandMap` follows `IKn`. `validateCommandMapEntry` refuses a non-object entry, a field of the wrong type, an `allowedTools` that is neither a string nor a list of strings, both or neither of `source` and `content`, and a `source` that is absolute, escapes the root, or passes through a link (through `validateComponentPath`, now with a `subject` label). Each refusal is a note naming the key, so the plugin is unavailable. A `plugin.json` map replaces `commands/` (with the shadow note unless a map source reaches the folder); an entry map adds to it. A map-only plugin supports `commands`.
- `bridges/commands/discover.ts`: after the declared paths, each map entry is discovered in order. Key rules: ends with `:`, holds `<` or `>`, whitespace, or `\p{Cf}`, or fails RN-2. Source rules: missing, not a regular file, a symlink, a dotfile, not `.md`. A directory source is walked and its key and overrides ignored. A second key on a loaded file, a generated-name collision, and an entry's `content` each skip with a warning.
- `bridges/commands/types.ts`: `DiscoveredCommand` is a `file` | `inline` union with optional `CommandOverrides`.
- `bridges/commands/staged-command.ts`: reads an inline command's text from `content`; writes the manifest `description` and `argumentHint` (as `argument-hint`) over the frontmatter's, in place; counts a manifest `model` for the dropped-fields line without staging it.
- `bridges/commands/stage.ts`: an inline command's record has `sourcePath` `<plugin root>#commands.<key>`. Inline commands join the ledger with no other change.

## Task Commits

1. **Task 1: Install a manifest's object map of command files under their keys, end to end** - `91506c2` (feat)
2. **Task 2: Refuse malformed map entries, and give a map the declaration rules of D-CF1-06 and D-CF3-04** - `3895b32` (feat)
3. **Task 3: Stage inline map content and the manifest overrides** - `618973b` (feat)

Tracer gate (Task 1): `end-of-phase` mode, automated-only `<verify>`. I re-ran it (the three unit modules, direct coverage of `component-paths.ts` and `discover.ts`, cucumber on `manifest-forms.feature` and `component-directories.feature`, `check:features`). All passed, so I continued with the expansion tasks.

## Red proofs

**Task 1, before the resolver and bridge change** (`npx cucumber-js features/slash-command/manifest-forms.feature --name "object map of commands lists each"`):

```text
Given the user has run "/claude:plugin install demo@fixtures --scope project"
  -  plugins: [ { id: "demo@fixtures", name: "demo", reasons: [ "unsupported source" ], status: "unavailable" } ]
  -  severity: "error", summary: "A plugin operation has failed."
  +[]
1 scenario (1 failed)
13 steps (9 passed, 3 skipped, 1 failed)
```

**Task 2, before the Task 2 resolver change** (the 13 Task 2 runs): `13 scenarios (4 passed, 9 failed)`.

- Entry map adds to the folder: the install Given failed, the plugin `unavailable` with `unsupported source`.
- Outline rows "both source and content" and "a description that is a number": `severity` was `info` and `needs reload` `true` (the plugin installed) where `error` and `false` were expected.
- The key outline (3 rows), the source outline (3 rows), and the two-keys scenario failed on the warning line, which read `command map entry "trail:" in "[redacted path]`. That exposed a Task 1 wording defect (see Deviations).

The four runs that passed before the change (the shadow note, the directory source, the outline row "neither", and one key-or-source row with the then-current wording fixed later) are pinned by the negative edit below.

**Task 2, negative edits** (applied together, then restored from scratch copies; `git diff` clean afterwards): `collectCommandMap` ignores refusals; no shadow note for a manifest map; `MAP_KEY_RULES` emptied; `mapSourceRefusal` returns `undefined`; directory sources not walked; the map-key same-file warning removed.

```text
12 scenarios (12 failed)
137 steps (108 passed, 17 skipped, 12 failed)
 1) ...both or neither... (row "neither"): Then the result has these fields -- severity info, not error
10) ...reports the commands folder it leaves unread: missing 'Default commands/ folder is ignored because the manifest sets "commands"'
12) ...source is a directory...: install failed 'EISDIR: illegal operation on a directory, read'
 9) Two command map keys...: missing 'command map entry "two" names "cmds/a.md", already loaded as command source "one"; skipping entry.'
```

**Task 3, before the types, discovery, and writer change** (the six Task 3 scenarios): `6 scenarios (6 failed)`.

```text
1) entry inline dropped: missing row 'command map entry "delta" sets "content", which a marketplace entry cannot declare; skipping entry.'
2) map model: missing row '[alpha] dropped fields: model'
3) argument hint: menu row '<file hint> -- [t] Runs alpha.' where '<target> -- [t] Runs alpha.' was expected
4) inline frontmatter: the listing lacks ['/demo:fm', 'FM in content']
5) inline listed: the listing lacks ['/demo:beta', 'Beta from the manifest.']
6) invocation: the model received '/demo:beta x' where 'Beta inline body x' was expected
```

## Non-owned test edits

- `test/architecture/declared-component-path-overlap.test.ts` (unpaired, not in `files_modified`): the expected discovered command gains `kind: "file"` because `DiscoveredCommand` is now a union. The commit hook's `test:unpaired` caught it. `git diff "$BASE"..HEAD -- test/architecture/declared-component-path-overlap.test.ts`:

  ```diff
  @@ -60,6 +60,7 @@
     assert.deepStrictEqual(discovery, {
       discovered: [
         {
  +        kind: "file",
           sourceName: "commit",
  ```

- `git diff "$BASE"..HEAD -- test/domain/plugin-resolver.test.ts` prints nothing: no resolver case changed.
- `git diff --stat "$BASE"..HEAD -- features/plugin` prints nothing.
- Owned test changes: `component-paths.test.ts`'s `emptyResolution()` now returns `ComponentPathResolution`, so a case can read `commandMap`; `discover.test.ts` expected objects gain `kind: "file"`; `staged-command.test.ts`'s helper returns a file command.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/resolver-types.ts` - the `commandMap` schema and `CommandMapEntry`
- `extensions/pi-claude-marketplace/domain/component-paths.ts` - map detection, validation, and the declaration rules (commands arm)
- `extensions/pi-claude-marketplace/bridges/commands/types.ts` - the `DiscoveredCommand` union and `CommandOverrides`
- `extensions/pi-claude-marketplace/bridges/commands/discover.ts` - map discovery and its warnings
- `extensions/pi-claude-marketplace/bridges/commands/staged-command.ts` - inline content and the overrides
- `extensions/pi-claude-marketplace/bridges/commands/stage.ts` - the synthetic source path
- `features/slash-command/manifest-forms.feature` - 13 scenarios and outlines
- the seven test files listed in `key-files`

## Decisions Made

- **Where each check lives.** The resolver refuses what upstream's manifest schema refuses (unavailable). The bridge skips what upstream's loader skips or refuses by name (warning, plugin installable).
- **Warning wording.** `command map entry "<key>" <reason>; skipping entry.` The reason quotes only plugin-relative paths.
- **Order.** `plugin.json` map entries, then entry map entries, all after the declared paths. A map key's generated-name collision uses the map wording: `command map entry "<key>" elides to generated name "<name>", already produced by command source "<winner>"; skipping entry.`
- **Directory sources** are checked before the key, so a directory under a bad key is still walked, as upstream ignores the key.
- **Empty strings.** An empty `source` or `content` counts as not set, and an empty override overrides nothing, as upstream's truthiness checks do.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Map warnings were cut short by path redaction**
- **Found during:** Task 2 (its scenarios' first run)
- **Issue:** The Task 1 wording `command map entry "<key>" in "<plugin root>" <reason>; skipping entry.` put quoted text after the quoted absolute root. `redactAbsolutePaths` then replaces everything from the root on with `[redacted path]`, so the user saw `command map entry "trail:" in "[redacted path]`.
- **Fix:** The warning no longer names the plugin root (the install row names the plugin). The same-file and collision warnings for a map key use the map wording.
- **Files modified:** `bridges/commands/discover.ts`, `test/bridges/commands/discover.test.ts` (both in the plan's files; committed with Task 2)
- **Committed in:** `3895b32`

**2. [Rule 2 - Missing critical] Hidden characters in a key echoed into a warning**
- **Found during:** Task 1
- **Issue:** A key with a bidi or zero-width character would have been printed raw in its own skip warning, which is the T-03-25 spoofing surface.
- **Fix:** `showHiddenCharacters` prints `\p{Cc}` and `\p{Cf}` characters as `\u{XXXX}` in map warnings.
- **Committed in:** `91506c2`

**3. [Rule 3 - Blocking] Unpaired architecture test pinned the old `DiscoveredCommand` shape**
- **Found during:** Task 3 commit (hook `check:commit` failed on `test/architecture/declared-component-path-overlap.test.ts`)
- **Fix:** Added `kind: "file"` to its expected value (see Non-owned test edits).
- **Committed in:** `618973b`

**4. [Rule 3 - Blocking] Literal hidden characters in a test file**
- **Found during:** Task 1 pre-commit (`forbid-bidi-controls`)
- **Fix:** The key rows build the zero-width space (U+200B) and the right-to-left override (U+202E) with `String.fromCodePoint`.
- **Committed in:** `91506c2`

---

**Total deviations:** 4 (1 bug, 1 missing critical, 2 blocking). **Impact:** wording and test-only adjustments; no scope change.

## Issues Encountered

- Inside the worktree, the commit hook ran `check:commit` only once (the Task 3 commit, where it caught deviation 3) and printed "(no files to check)" for the others. Before each commit I ran `npm run check:static`, the owner tests, and direct coverage by hand.
- An unavailable map plugin's install row shows the existing reason label `unsupported source`; the per-entry note stays in the resolver notes, as for every structural refusal.

## Verification

- `node --test` on `component-paths.test.ts`, `resolver-types.test.ts`, `plugin-resolver.test.ts`, and the four commands-bridge test modules: pass.
- `npm run test:coverage:direct --` for `component-paths.ts`, `discover.ts`, `staged-command.ts`, `stage.ts`, `types.ts`: no shortfall.
- `TEST_CONCURRENCY=4 npm run test:modules`: pass. `npm run test:unpaired`: pass.
- `npx cucumber-js features/slash-command features/plugin/component-directories.feature features/plugin/staging-warnings.feature`: 93 scenarios, 1095 steps, all pass.
- `npm run check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features): pass after each task. `npx fallow dupes --fail-on-issues --format human --quiet`: exit 0.
- I did not run the full `npm run check` (integration tests included), because two executors share this machine. The orchestrator's post-merge gate runs it.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-03-24 mitigated: the resolver refuses an absolute, escaping, or linked map `source` (unit case "D-CF3-03 refuses a command map source that passes through a symbolic link" and the absolute and escape rows); the bridge reads only a regular non-dot `.md` file found by `lstat` (unit case "skips each command map source that is not a command file").
- T-03-25 mitigated: `\p{Cf}` keys are skipped, and a key's hidden characters are shown as code points in the warning.
- T-03-26 mitigated: overrides go through the JSON-flow rebuild and the read-back check; unit cases cover override placement.

## Dubious Choices

1. **`\p{Cf}` keys are skipped**, beyond D-CF3-03's list, following upstream's `sbs` rule (03-UPSTREAM-EVIDENCE Q3.11), as the plan and P3-DC-09 direct.
2. **`allowedTools` accepts a string.** The plan says "neither a string nor an array of strings"; upstream's schema (`A(o())`) accepts only an array of strings, so `"allowedTools": "Read"` installs here and fails upstream.
3. **Map warnings drop the plugin root** that the walk's warnings carry, to survive path redaction (deviation 1). The walk's own `duplicateWarning` keeps the root and is still cut short by the same redaction when it is shown (pre-existing, not changed).
4. **Hidden characters are escaped as `\u{XXXX}`** in map warnings only; resolver notes that name a key print it raw (they are not shown for an unavailable plugin's install row).
5. **A map source inside `commands/` suppresses the shadow note**, extending D-CF1-06's reach rule to map sources; upstream was not probed for this.
6. **A directory source under a bad key is still walked**, because the key is ignored for a directory (upstream ignores it too).
7. **A missing map source is an install warning**; upstream shows "failed to load" in `plugin list` and says nothing at install.
8. **The argument-hint scenario's file sets its own `argument-hint`** (`<file hint>`), so the scenario proves the override, beyond the plan's literal fixture.
9. **The outline row "neither source nor content" also failed before this plan** (as a not-a-string refusal), so its proof is the negative edit, not a red run.
10. **The unavailable outline shows the reason `unsupported source`** for all three rows; the unit cases tell the notes apart.

## Parent lines

- **Info listing residual:** `/claude:plugin info` does not list map entries (or declared command files). The lenient mirror in `orchestrators/plugin/info.ts` already leaves an entry map out (an object is not a string), so it needed no change.
- **Windows residual:** a key holding `:` in the middle stages a file name NTFS refuses, so that install fails on Windows; the D-CF3-03 key rules do not refuse it (T-03-27, accepted).
- **Redaction (shared):** `shared/redact-absolute-paths.ts` replaces the rest of a line with `[redacted path]` when quoted text follows a quoted absolute path, which also cuts the walk's existing duplicate and subdirectory warnings. A fix belongs to the owner of that module.
- **CHANGELOG.md (suggested line):** "A plugin can declare its commands as an object map, as in Claude Code: each entry becomes `/<plugin>:<key>`, from a file or inline content, with the map's description, argument hint, and model applied."
- **PROJECT.md Key Decisions:** none.

## Next Phase Readiness

- Plan 03-09 (phase gate) can run `npm run check` on the merged wave.

## Self-Check: PASSED

- FOUND: every file in `key-files.modified`.
- FOUND commits on this branch: `91506c2`, `3895b32`, `618973b`. `git rev-list --count f7fcf84..HEAD` = 3 before this SUMMARY.
- Acceptance greps: `commandMap` in resolver-types.ts 2; `D-CF3-03` in component-paths.ts and discover.ts 7 and 8 or more; the tracer title 1; the both-or-neither outline title 1 with 3 `Examples:` rows; `"inline"` in types.ts 1; `#commands.` in stage.ts 2; `Beta inline body x` 1; `fallow dupes` exit 0; `git diff --stat $BASE..HEAD -- features/plugin` empty.

---
*Phase: 03-slash-commands*
*Completed: 2026-11-01*
