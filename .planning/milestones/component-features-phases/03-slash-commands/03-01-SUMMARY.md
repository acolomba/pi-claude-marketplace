---
phase: 03-slash-commands
plan: 01
subsystem: bridges/commands
tags: [commands, frontmatter, description-fallback, cucumber, fallow]

requires:
  - phase: 01-harness-and-version-raise
    provides: descriptionFallback core, the registry probe listing steps, the slash-command seed feature
provides:
  - buildStagedCommand, the single writer of a staged command's text (JSON-flow frontmatter, D-CF3-08 description, read-back check)
  - withCommandRecord and the pi-claude-marketplace {pluginRoot, pluginData} record in every staged command (D-CF3-06 install half)
  - the shared slash-command steps (command-file Given, empty prompt-template listing Then) and publishSlashCommandFile
  - listing scenarios for the fallback rules, the degraded command, nested names, the CM-2 elision, and the CM-4 dotfile skip
affects: [03-02 dropped fields, 03-03 invocation handler (reads the record), 03-08 map overrides and inline content]

actuals:
  tokens: 15180
  tasks: 3
  commits: 3

plan_head_before: 735b9c2d088b9c77fc1472bc0965dbf2d68a61fc
plan_head_after: b6a3912

tech-stack:
  added: []
  patterns:
    - "Staged command frontmatter is rebuilt as one JSON line per key and re-parsed with Pi's parser before it is written"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/commands/staged-command.ts
    - extensions/pi-claude-marketplace/bridges/commands/command-record.ts
    - test/bridges/commands/staged-command.test.ts
    - test/bridges/commands/command-record.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/commands/stage.ts
    - extensions/pi-claude-marketplace/bridges/commands/discover.ts
    - extensions/pi-claude-marketplace/bridges/commands/unstage.ts
    - test/bridges/commands/stage.test.ts
    - features/slash-command/listing.feature
    - features/step_definitions/slash-command/listing.steps.ts
    - features/lib/slash-command-files.ts

key-decisions:
  - "The writer mirrors Pi's extractFrontmatter, including Pi's own second BOM strip, so a source behind two byte-order marks rebuilds from the frontmatter Pi reads"
  - "The read-back compares the JSON form of the parsed frontmatter (key order included) and the trimmed body; a reparse throw (an implicit key over 1024 characters) is a BridgeStagingError naming the command"
  - "Of the four commands-bridge clone markers, only stage.ts above discoverPluginCommands still covers a group (dup:23c99c81); the other three are deleted"

patterns-established:
  - "Every staged-text change goes through buildStagedCommand; stage.ts keeps only names, containment, the write, renames, and the degraded record"

requirements-completed: [CMD-01]

coverage:
  - id: D1
    description: "A new session lists a description-less command with Claude Code's A2e fallback, written into the staged frontmatter"
    requirement: CMD-01
    verification:
      - kind: e2e
        ref: "features/slash-command/listing.feature#A command without a description is listed with the first line of its body"
        status: pass
      - kind: e2e
        ref: "features/slash-command/listing.feature#A command without a description is listed with Claude Code's fallback for its body (5 rows)"
        status: pass
      - kind: e2e
        ref: "features/slash-command/listing.feature#A command whose frontmatter does not parse is listed with the fallback of its body"
        status: pass
      - kind: unit
        ref: "test/bridges/commands/staged-command.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nested names, the CM-2 elision (D-141-01), and the CM-4 dotfile skip are pinned through Pi's listing"
    requirement: CMD-01
    verification:
      - kind: e2e
        ref: "features/slash-command/listing.feature#A nested command file is listed with its directories colon-joined"
        status: pass
      - kind: e2e
        ref: "features/slash-command/listing.feature#A command file whose name starts with the plugin name is listed without that prefix, as recorded under D-141-01"
        status: pass
      - kind: e2e
        ref: "features/slash-command/listing.feature#A command file whose name starts with a dot is not offered, as recorded under CM-4"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every staged command ends its frontmatter with the install-time pluginRoot/pluginData record, added after substitution and the reference rewrite"
    requirement: CMD-01
    verification:
      - kind: unit
        ref: "test/bridges/commands/command-record.test.ts"
        status: pass
      - kind: unit
        ref: "test/bridges/commands/staged-command.test.ts#T-03-02 adds the record after the substitution and the reference rewrite"
        status: pass
      - kind: unit
        ref: "test/bridges/commands/stage.test.ts#D-CF3-06 records the same plugin root and data at user and project scope"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-11-01
status: complete
---

# Phase 3 Plan 01: Staged command writer and listing pins Summary

**A bridged command with no description is now listed by Claude Code's `A2e` fallback, which install writes into a rebuilt JSON-flow frontmatter. Every staged command also carries the install-time `pluginRoot`/`pluginData` record that the invocation handler reads.**

## Performance

- **Duration:** about 40 min
- **Started:** 2026-11-01T17:16:00Z (base commit `735b9c2` at 17:15:56Z)
- **Completed:** 2026-11-01T17:56:00Z
- **Tasks:** 3 of 3
- **Files modified:** 11 (4 created, 7 modified)
- **Baseline:** `BASE=735b9c2d088b9c77fc1472bc0965dbf2d68a61fc`

## Accomplishments

- `bridges/commands/staged-command.ts` (`buildStagedCommand`) is now the one writer of a staged command's text. It reads the source and drops one BOM. It runs the PARSE-01 gate, with `neutralizeCommandFrontmatter` moved here unchanged except for its doc comment. Then it runs CM-3 substitution and the reference rewrite. It rebuilds the frontmatter as one `"<key>": <JSON>` line per key, sets `description` to `descriptionFallback(body, "Plugin command")` when the source has no non-empty string description, and appends the record. Last, it re-parses its output with Pi's parser.
- `bridges/commands/command-record.ts`: `CommandRecord` and `withCommandRecord`. The record key is last, and an author value under the key is replaced.
- `stage.ts` stages each command through the writer. It keeps the name check, the containment checks, the staged-file write, the rename pairs, the degraded record, and `contextualStagingError`.
- Shared slash-command steps: the command-file Given, `pi offers no slash commands from prompt templates`, and `publishSlashCommandFile`.
- Nine new listing scenarios (one tracer, a five-row Outline, and the degraded, nested, elision, and dotfile scenarios). The seed scenario passes unchanged.

## Task Commits

1. **Task 1: List a description-less command with Claude Code's fallback, end to end** - `46303a8` (feat)
2. **Task 2: Pin the fallback rules and the naming rules a new session lists** - `643be2d` (test)
3. **Task 3: Store each command's install-time plugin root and data, and clear stale clone markers** - `b6a3912` (feat)

## Step texts added

- `Given the published plugin {string} of the marketplace {string} has the slash command {string} with this command file:` (the doc string is written verbatim to `commands/<name>.md`. A nested name is allowed, and an existing file is replaced.)
- `Then pi offers no slash commands from prompt templates`

## Red proof (Task 1, before the writer existed)

```text
Failed scenarios:
  1) A command without a description is listed with the first line of its body # features/slash-command/listing.feature:25
       Then pi offers these slash commands from prompt templates:
           +     'Deploy the current branch to the staging environment and rep...'
           -     'Deploy the current branch to the staging environment and report the result.'
2 scenarios (1 passed, 1 failed)
```

## Negative-edit proofs (Task 2, each reverted with `git checkout -- <file>` before committing)

1. Nested segments joined with `-` (`domain/name.ts` `generatedCommandName`):
   ```text
   +     '/demo:build-web',
   -     '/demo:build:web',
   ```
2. CM-2 elision skipped (`elidedHead = head`):
   ```text
   +     '/demo:demo-lint',
   -     '/demo:lint',
   ```
3. Dotfiles kept in the walk. Editing only the `discover.ts` dot check left the scenario green, because `shared/fs-utils.ts` `isPlainMarkdownFile` also drops dotfiles. The proof edits both checks:
   ```text
   + [
   +   'demo:.hidden'
   + ]
   - []
   ```
4. Description rule reverted in the writer (`stagedFrontmatter` returns the source keys only): 7 of 11 listing scenarios fail, each showing Pi's own rule:
   ```text
   2) ...fallback for its body # listing.feature:68   + '# Deploy a change'                  - 'Deploy a change'
   6) ...                      # listing.feature:69   + 'Run the full release checklist for the current branch, then ...'
   3) ...                      # listing.feature:70   + 'Run the full release checklist for the current branch, then ...'
   7) ...                      # listing.feature:71   + ''                                   - 'Plugin command'
   4) ...                      # listing.feature:72   + 'Review the open pull requests of this repository and summari...'
   5) ...does not parse...     # listing.feature:74   + 'Repair the build after a failed run and report which steps c...'
   1) tracer                   # listing.feature:25   + 'Deploy the current branch to the staging environment and rep...'
   11 scenarios (4 passed, 7 failed)
   ```

`git diff --stat 735b9c2..HEAD -- extensions/pi-claude-marketplace/domain/name.ts` prints nothing. `shared/fs-utils.ts` is also unchanged.

## Clone-marker measurement (Task 3)

Measured on this tree. I deleted all four commands-bridge markers and ran `npx fallow dupes --format human`: `No code duplication found`. Then I also deleted the skills-side markers for a while and ran it again. One group remains:

```text
28 lines  2 instances  dup:23c99c81
  extensions/pi-claude-marketplace/bridges/commands/stage.ts:102-128
  extensions/pi-claude-marketplace/bridges/skills/stage.ts:437-464
```

After that I restored the skills files with `git checkout --`. That leaves `git status` clean for `bridges/skills/**`.

| Marker (before) | Fate | Why |
| --- | --- | --- |
| `commands/stage.ts:160` (above `discoverPluginCommands`) | kept, now at line 102 | `dup:23c99c81` still spans `commands/stage.ts:102-128` |
| `commands/stage.ts:276` (above `return { kind: "staged", ...`) | deleted | covers no group |
| `commands/discover.ts:314` | deleted | covers no group |
| `commands/unstage.ts:29` | deleted | covers no group (`dup:3989c3f1` is gone) |

`npx fallow dupes --fail-on-issues --format human --quiet` exits 0, and so does `npm run fallow`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/commands/staged-command.ts` - the staged-command writer
- `extensions/pi-claude-marketplace/bridges/commands/command-record.ts` - the D-CF3-06 record
- `extensions/pi-claude-marketplace/bridges/commands/stage.ts` - stages through the writer; 1 of 2 markers removed
- `extensions/pi-claude-marketplace/bridges/commands/discover.ts`, `unstage.ts` - stale markers removed
- `test/bridges/commands/staged-command.test.ts`, `command-record.test.ts` - new paired tests, 100% direct coverage
- `test/bridges/commands/stage.test.ts` - expected staged bytes changed to the JSON-flow form with the record; one scope row added
- `features/slash-command/listing.feature`, `features/step_definitions/slash-command/listing.steps.ts`, `features/lib/slash-command-files.ts`

## Decisions Made

- **Second BOM strip.** The rebuild normalizes the way Pi's `extractFrontmatter` does, and that includes Pi's own `stripBom`. A source behind two BOMs therefore rebuilds from the frontmatter Pi reads, not from a body that holds a stray fence.
- **Read-back form.** `JSON.stringify(reparsed.frontmatter) === JSON.stringify(written)` is equal to "deep-equal to the JSON round trip" with key order added. The body is compared with Pi's parse of the substituted source, trimmed (Pitfall 5 residual).
- **`CommandRecord` is exported** because `staged-command.ts` uses it to type the record it builds. Without a consumer, fallow would report the type as unused.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A source behind two byte-order marks**
- **Found during:** Task 1
- **Issue:** The bridge strips one BOM, and Pi's `parseFrontmatter` strips one more. A rebuild that looked for the fence on the once-stripped text would miss the fence. It would keep the whole source as the body, and the read-back would refuse the command.
- **Fix:** `rebuildCommandText` applies `stripBom` before the newline normalization, as Pi does.
- **Files modified:** `bridges/commands/staged-command.ts`
- **Verification:** unit case "reads a source behind two byte-order marks the way Pi does"
- **Committed in:** `46303a8`

**2. [CLAUDE.md / typescript-style comments rule] No `P3-DC-09` in code comments**
- **Found during:** Task 1
- **Issue:** The plan asked the module doc to cite "P3-DC-09 item 1". That ID names a phase-numbered planning artifact, and the comments rule plus the plan's own executor rule ("never a phase") forbid it.
- **Fix:** The doc states the rule itself (one JSON line per key, no duplicate key) and cites D-CF3-08, D-CF1-04, CMD-01, CM-3, D-CF3-06, and T-03-01/T-03-02.
- **Committed in:** `46303a8`, `b6a3912`

**3. [Rule 3 - Blocking] The dotfile negative edit needed a second temporary edit**
- **Found during:** Task 2
- **Issue:** Keeping dotfiles in the `discover.ts` walk alone did not change the listing, because `shared/fs-utils.ts::isPlainMarkdownFile` also skips dotfiles.
- **Fix:** The temporary edit covered both checks, and both were reverted. Nothing was committed.

---

**Total deviations:** 3 (1 bug, 1 convention, 1 proof mechanics). **Impact:** none on scope. Each one keeps the plan's intent.

## Non-owned test edits

None. `npm run test:modules` passed after Task 1 and after Task 3 with no edit outside `test/bridges/commands/**`. `git diff --stat 735b9c2..HEAD -- test ':!test/bridges/commands'` prints nothing.

## Verification

- `node --test` on the five commands-bridge test files: 72 pass.
- `npm run test:coverage:direct --` for `command-record.ts`, `staged-command.ts`, `stage.ts`, `discover.ts`, and `unstage.ts`: no shortfall.
- `npm run test:modules`: pass.
- `npx cucumber-js features/slash-command features/skill`: 92 scenarios pass.
- `npm run check:static` (typecheck, lint, fallow, format, pairing, check:features): pass.
- `npm run check` at `b6a3912` (worktree, combined with Phase 2 code on this branch): exit 0. Static checks pass, the unpaired and integration tests pass, cucumber passes (1261 scenarios, 13104 steps), and direct coverage of all pairs passes (`Merged LCOV: coverage/direct.lcov (321 records)`).

## Issues Encountered

- Inside the worktree, the commit hook's `npm run check:commit` and prettier reported "(no files to check)". So I ran `npm run check:static`, the owner tests, and direct coverage by hand before each commit.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-03-01 is mitigated by the JSON-line rebuild and the read-back check, with the unit case "T-03-01 refuses a rebuilt frontmatter that Pi cannot read back". T-03-02 is mitigated by adding the record last, with the unit cases "T-03-02 adds the record after the substitution and the reference rewrite" and the author-key replacement case.

## Dubious Choices

1. **The read-back check can fail an install.** A frontmatter key longer than 1024 characters, which is legal in the source as an explicit `? key`, becomes an implicit key in the JSON-flow rebuild. Pi's YAML parser refuses that, so the install fails with `BridgeStagingError` and does not degrade. A reviewer might prefer to drop that key with a warning.
2. **Description fallback input.** The fallback is computed on the body after CM-3 substitution and the reference rewrite, which is the body Pi loads. Claude Code computes `A2e` on the unsubstituted body. The difference shows only when the first line names `${CLAUDE_PLUGIN_ROOT}` or a sibling reference (flagged in the plan).
3. **A list or scalar frontmatter is dropped silently.** The command is rebuilt from no keys, with no warning.
4. **Outline rows with no declared description write `description:` (YAML null), not an absent key.** The absent-key and null cases differ only inside the writer, and the unit suite covers both. The scenarios cover null, `""`, and no frontmatter at all (the tracer).
5. **The fallback Outline's 101-character row.** It lists `...tag it ...`: the 97-character cut ends on a space, and the scenario pins that as `A2e` does.
6. **The mocked neutralize-safeguard cases.** They are mirrored in `staged-command.test.ts`, as they already are in `stage.test.ts`. They mock `String.prototype.startsWith` and `indexOf`, because those two `neutralizeCommandFrontmatter` branches cannot be reached by real input. The plan asked for the function to move unchanged, so I kept it and did not remove the dead branches.
7. **Only the skills-side marker is needed to keep `dup:23c99c81` hidden.** One marker on either side hides the whole group. The commands-side marker stays because the plan's rule keeps a live marker above a line its group spans.

## Parent lines

- **Phase 2-owned stale markers (still stale, not caused by this change):** `bridges/skills/stage.ts:523` (above `return { kind: "staged", ...`) and `bridges/skills/unstage.ts:89` cover no group. With every marker in both bridges deleted, only `dup:23c99c81` remains. The live skills marker `bridges/skills/stage.ts:437` stays. This change ended no skills-side group.
- **CONVENTIONS.md "Suppressions":** the repo-wide `fallow-ignore` count goes from 47 to 44, and `code-duplication` markers go from 29 to 26. The commands bridge now keeps one: `bridges/commands/stage.ts` above `discoverPluginCommands`. The bullet's listed pairs should drop the commands `discover.ts` and `unstage.ts` entries. (The doc's own "41" and "Thirty" were already out of date on this branch.)
- **CHANGELOG.md (suggested line):** "Slash commands with no `description` are now listed with Claude Code's description (the first body line, up to 100 characters), not Pi's 60-character cut."
- **PROJECT.md Key Decisions:** none.

## Next Phase Readiness

- Plan 03-02 (dropped fields) and 03-08 (map overrides, inline content) extend `buildStagedCommand`. Plan 03-03 reads the `pi-claude-marketplace` record from the staged frontmatter. It needs a typebox-checked reader, which lands with its first consumer.

## Self-Check: PASSED

- FOUND: `bridges/commands/staged-command.ts`, `bridges/commands/command-record.ts`, `test/bridges/commands/staged-command.test.ts`, `test/bridges/commands/command-record.test.ts`
- FOUND commits on this branch: `46303a8`, `643be2d`, `b6a3912`. `git rev-list --count 735b9c2..b6a3912` = 3
- Acceptance greps: `with this command file:` 1; `descriptionFallback(` 1 or more; non-comment `neutralizeCommandFrontmatter` in `stage.ts` 0; tracer title 1; Outline title 1 with 5 rows (one `Plugin command`); empty-listing step 1 and its use 1; `/demo:build:web` 1; `/demo:lint` 1; `withCommandRecord(` 1; `/skills/` imports 0

---
*Phase: 03-slash-commands*
*Completed: 2026-11-01*
