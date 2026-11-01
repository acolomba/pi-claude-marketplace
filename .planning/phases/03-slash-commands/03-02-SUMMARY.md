---
phase: 03-slash-commands
plan: 02
subsystem: bridges/commands
tags: [commands, frontmatter, dropped-fields, cucumber, tui]

requires:
  - phase: 03-slash-commands
    provides: buildStagedCommand (the staged-command writer and its PARSE-01 gate), the command-file Given
  - phase: 01-harness-and-version-raise
    provides: droppedInvocationFieldsWarning core, startTuiSession and the TUI driver, the model and session steps
provides:
  - the D-CF3-09 dropped-fields line of each command (StagedCommandText.droppedFields)
  - prepareStageCommands returns the discover warnings, then one discovery warning per dropped-fields line
  - features/slash-command/frontmatter.feature (7 scenarios, CMD-03)
  - the terminal slash-menu When and Then (features/step_definitions/slash-command/frontmatter.steps.ts), which plan 03-08 reuses
affects: [03-08 manifest argumentHint (reuses the menu steps), 03-03 invocation handler (the user-invocable run scenario must stay green)]

actuals:
  tokens: 7026
  tasks: 3
  commits: 3

plan_head_before: 0ab69e590d8119ba4541225ae06d9899616dcd37
plan_head_after: 05935e34a040275264ce7f167c31a428bc13ba1a

tech-stack:
  added: []
  patterns:
    - "A Then reads Pi's terminal menu from the world's TUI session: the last selection marker, then fixed 120-column rows"

key-files:
  created:
    - features/slash-command/frontmatter.feature
    - features/step_definitions/slash-command/frontmatter.steps.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/commands/staged-command.ts
    - extensions/pi-claude-marketplace/bridges/commands/stage.ts
    - test/bridges/commands/staged-command.test.ts
    - test/bridges/commands/stage.test.ts

key-decisions:
  - "The writer reads the dropped fields from the frontmatter the PARSE-01 gate parsed from the source (before substitution); a degraded source returns no line"
  - "Pi joins an argument hint and a description with an em dash; the repository's dash fixer rewrites an em dash in a feature file, so the menu Then states it as `--`"
  - "The menu readiness waits for `[Extensions]`, which Pi prints after the session_start handlers ran, so Phase 2's alias suggestions are in the menu before the first keystroke"

patterns-established:
  - "Slash-menu rows are compared whole, every row, through the unedited features/lib/pi-tui.ts"

requirements-completed: [CMD-03]

coverage:
  - id: D1
    description: "Installing a command that sets fields Pi cannot honor reports one declared-component note naming them in frontmatter order"
    requirement: CMD-03
    verification:
      - kind: e2e
        ref: "features/slash-command/frontmatter.feature#Installing a command that sets fields pi cannot honor reports them"
        status: pass
      - kind: e2e
        ref: "features/slash-command/frontmatter.feature#A command that sets every field pi cannot honor reports them in its frontmatter order"
        status: pass
      - kind: unit
        ref: "test/bridges/commands/staged-command.test.ts#D-CF3-09 names the fields pi cannot honor that a command sets, in frontmatter order"
        status: pass
      - kind: unit
        ref: "test/bridges/commands/stage.test.ts#D-CF3-09 returns the discover warnings, then each dropped-fields line in command order"
        status: pass
    human_judgment: false
  - id: D2
    description: "A degraded command reports no dropped-fields line (D-CF3-09 backstop)"
    requirement: CMD-03
    verification:
      - kind: unit
        ref: "test/bridges/commands/staged-command.test.ts#D-CF3-09 reports no dropped field for a source whose frontmatter does not parse"
        status: pass
    human_judgment: false
  - id: D3
    description: "Honored fields are silent; user-invocable: false is listed and runs; the model's skill list holds no bridged command"
    requirement: CMD-03
    verification:
      - kind: e2e
        ref: "features/slash-command/frontmatter.feature#A command that sets only fields pi honors or that have their own decision reports no dropped field"
        status: pass
      - kind: e2e
        ref: "features/slash-command/frontmatter.feature#A command that is not user-invocable is still listed, because pi cannot hide a template"
        status: pass
      - kind: e2e
        ref: "features/slash-command/frontmatter.feature#A command that is not user-invocable runs when the user types it"
        status: pass
      - kind: e2e
        ref: "features/slash-command/frontmatter.feature#The model's system prompt lists no bridged command"
        status: pass
    human_judgment: false
  - id: D4
    description: "A command's argument-hint is shown in Pi's terminal slash menu, compared row by row"
    requirement: CMD-03
    verification:
      - kind: automated_ui
        ref: "features/slash-command/frontmatter.feature#A command's argument hint is shown in pi's terminal menu"
        status: pass
    human_judgment: false

duration: 42min
completed: 2026-11-01
status: complete
---

# Phase 3 Plan 02: Slash command frontmatter Summary

**Installing a command that sets `model`, `effort`, or any other field Pi cannot honor now reports `[<command>] dropped fields: ...` as a declared-component note. Seven scenarios pin that line, the fields Pi honors, `user-invocable: false`, the model's skill list, and the `argument-hint` in Pi's terminal slash menu.**

## Performance

- **Duration:** about 42 min
- **Started:** 2026-11-01T18:15:02Z
- **Completed:** 2026-11-01T18:56:51Z
- **Tasks:** 3 of 3
- **Files modified:** 6 (2 created, 4 modified)
- **Baseline:** `BASE=0ab69e590d8119ba4541225ae06d9899616dcd37`

## Accomplishments

- `buildStagedCommand` keeps the frontmatter that the PARSE-01 gate parsed from the source, and returns `droppedFields` from `droppedInvocationFieldsWarning(command.sourceName, ...)`. A source whose frontmatter does not parse returns none. A small `frontmatterKeys` helper now serves both this read and the D-CF3-08 description rule, so a list or scalar frontmatter counts as empty in both.
- `prepareStageCommands` collects each command's line and returns `[...discoverWarnings, ...droppedFields].map(discoveryWarning)`. The noop branch is unchanged. Both functions stay under the two complexity gates (`npm run check:static` passes).
- `features/slash-command/frontmatter.feature`: 7 scenarios (the tracer, the all-eight order, honored fields, user-invocable listed, user-invocable runs, the model's skill list, the argument hint in the terminal menu).
- `features/step_definitions/slash-command/frontmatter.steps.ts`: the terminal slash-menu When and Then.

## Task Commits

1. **Task 1: Report the frontmatter fields Pi cannot honor when a command installs, end to end** - `6e47ebf` (feat)
2. **Task 2: Pin the fields Pi honors, a command that is not user-invocable, and the model's view of commands** - `e3600a1` (test)
3. **Task 3: Show a command's argument hint in Pi's terminal slash menu** - `05935e3` (test)

## Step texts added

- `When the user types the slash command prefix {string} in pi's terminal` (starts the world's TUI session, waits for `[Extensions]`, types the prefix, waits for the selection marker `→ ` and 250 ms of quiet output)
- `Then pi's terminal menu offers these slash commands:` (columns `command` and `text`; compares every row of the last menu drawn; fails when the terminal shows no menu)

## Red proof (Task 1, before the writer change)

```text
  Then the command reports these results:
    AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
      [ 'kind', 'severity', 'needs reload', -'header', -'lines' ],
      [ 'cascade', 'info', 'true', -'', -'' ],
    - [ 'diagnostic', 'warning', 'false',
    -   'Plugin "demo" [project] installed; 1 declared component has a note.',
    -   '[deploy] dropped fields: model, effort' ]
1 scenario (1 failed)
9 steps (7 passed, 1 skipped, 1 failed)
```

## Negative-edit proofs (each reverted with `git checkout -- <file>`; nothing committed)

1. **A: the writer reports the fields in reverse order** (`staged-command.ts` passed a key-reversed frontmatter to the core). Scenario 1 and the all-eight scenario fail:
   ```text
   1) Installing a command that sets fields pi cannot honor reports them   # frontmatter.feature:6
        +     '[deploy] dropped fields: effort, model'
        -     '[deploy] dropped fields: model, effort'
   3) A command that sets every field pi cannot honor reports them in its frontmatter order   # :31
        +     '[audit] dropped fields: disallowed-tools, model, effort, agent, context, background, hooks, paths'
        -     '[audit] dropped fields: paths, hooks, background, context, agent, effort, model, disallowed-tools'
   ```
2. **B: the writer also reports `allowed-tools`** (same run as A). The honored-fields scenario fails:
   ```text
   2) A command that sets only fields pi honors or that have their own decision reports no dropped field   # :62
        +     'diagnostic', 'warning', 'false',
        +     'Plugin "demo" [project] installed; 1 declared component has a note.',
        +     '[tidy] dropped fields: allowed-tools'
   6 scenarios (3 passed, 3 failed)
   ```
3. **C: the stage loop skips a command whose staged text sets `"user-invocable": false`** (run alone, so it cannot hide B). Both user-invocable scenarios fail:
   ```text
   1) A command that is not user-invocable is still listed, because pi cannot hide a template   # :90
        -   [ '/demo:hidden', 'Runs the hidden check.' ]
   2) A command that is not user-invocable runs when the user types it   # :113
        +     '/demo:hidden'
        -     'Run the hidden check.'
   2 scenarios (2 failed)
   ```
4. **D: the command reaches the model's skill list** (`orchestrators/discover.ts` returned `[...skillPaths, ...promptPaths]` as the skill paths, so Pi also loaded the prompts dir as skills):
   ```text
   1) The model's system prompt lists no bridged command   # :139
        +   [ 'prompts', 'Deploys the branch.',
        +     '{project dir}/.pi/pi-claude-marketplace/resources/prompts/demo:deploy.md' ]
   1 scenario (1 failed)
   ```
5. **E: the writer drops the `argument-hint` key** (`stagedFrontmatter` filtered the key out):
   ```text
   1) A command's argument hint is shown in pi's terminal menu   # :167
        +     '[t] Deploys the branch.'
        -     '<environment> -- [t] Deploys the branch.'
   1 scenario (1 failed)
   ```

## TUI spike findings (Task 3)

Spike: project install of `demo` with `deploy` (`argument-hint: <environment>`) and `destroy` (no hint), `this.startTuiSession()`, type `/demo:de`, wait for `→ `, then 500 ms of quiet output.

- **Readiness.** The default readiness text (`Warning: No models available. ...`) comes after the startup resource listing, which ends with `[Extensions]` / `pi-claude-marketplace`. So the default readiness already means that the session_start handlers ran and the autocomplete is set up. The menu appeared on the first keystrokes. The step still waits for `[Extensions]` (it returns at once) to state that precondition. `features/lib/pi-tui.ts` is unedited (`git diff --stat $BASE..HEAD -- features/lib/pi-tui.ts` prints nothing).
- **Row shape.** The PTY is 40x120 (`pi-tui-pty.py`), and Pi pads every menu row to 120 columns, with no newline between rows in the control-stripped text. A row is `→ ` (selected) or two spaces, the command name with no slash, padding, then the text. The captured menu:
  ```text
  '→ demo:deploy      <environment> — [t] Deploys the branch.          ...'
  '  demo:destroy     [t] Destroys the branch.                         ...'
  '  demo:demo-skill                                                   ...'
  ```
- **Join.** pi-tui's `CombinedAutocompleteProvider` builds the text as `${hint} — ${description}` (an em dash). The description already carries Pi's source tag.
- **Source tag.** Pi prints `[t]` for a prompt template that an extension discovered (`getAutocompleteSourceTag`: not user or project scope, so `t`).
- **Third row.** `demo:demo-skill` is Phase 2's skill-alias suggestion (`edge/skill-aliases.ts` adds an autocomplete provider at session_start). The scenario lists it because the Then compares every row.
- **Stability.** The scenario passed 5 of 5 runs alone and in the full `features/slash-command` run.

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/commands/staged-command.ts` - `droppedFields` in the writer's result, `CommandSource` union, `frontmatterKeys`
- `extensions/pi-claude-marketplace/bridges/commands/stage.ts` - collects the lines after the discover warnings
- `test/bridges/commands/staged-command.test.ts` - 5 new cases (named fields, nested source name, no frontmatter, honored fields only, degraded); the 4 D-CF3-08 description rows now also expect `[deploy] dropped fields: model`, because their source sets `model: sonnet`
- `test/bridges/commands/stage.test.ts` - 1 new case (warning order); the BOM case now expects its `[deploy] dropped fields: model` warning
- `features/slash-command/frontmatter.feature`, `features/step_definitions/slash-command/frontmatter.steps.ts`

## Decisions Made

- **Which frontmatter.** The line comes from the frontmatter that the PARSE-01 gate parsed from the BOM-stripped source, before substitution, as the plan says. Substitution changes values, not key names.
- **Result type.** `droppedFields` is an optional member, set only when there is a line, so a command that drops nothing still returns `{ text }` (or `{ text, parseError }`). `parseError` and `droppedFields` never appear together.
- **Em dash.** Pi renders `<hint> — <description>`. The `fix-unicode-dashes` pre-commit hook rewrote the em dash in the feature file to `--`. So the Then maps `—` to `--`, and the feature states `<environment> -- [t] Deploys the branch.`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The repository's dash fixer rewrites the em dash that Pi renders**
- **Found during:** Task 3 (pre-commit before the commit)
- **Issue:** `fix-unicode-dashes` (no `features/` exclusion in `.pre-commit-config.yaml`) changed `—` in the menu table to `--`, which would fail the scenario. CI runs the same hook on all files.
- **Fix:** The Then states Pi's em dash as `--` (a named constant, with a comment). `.pre-commit-config.yaml` is unchanged.
- **Files modified:** `features/step_definitions/slash-command/frontmatter.steps.ts`, `features/slash-command/frontmatter.feature`
- **Verification:** the feature passes, and negative edit E fails on the hint.
- **Committed in:** `05935e3`

**2. [Rule 1 - Bug, test expectations] Existing unit cases whose sources set `model`**
- **Found during:** Task 1
- **Issue:** Four D-CF3-08 description rows in `staged-command.test.ts` and the BOM case in `stage.test.ts` set `model: sonnet`. With the new line, their whole-value assertions failed.
- **Fix:** Their expected values now include the line. Their inputs are unchanged.
- **Committed in:** `6e47ebf`

**3. [Environment] Commit trailer session**
- The commit messages end with `Claude-Session: https://claude.ai/code/session_01EDUMG8nFuockQFTkJixpie`, which is the session line in this executor's harness attribution reminder. The orchestrator prompt asked for `session_01EDUMG5ARYqF6oZYKmj6oB3`. The parent should check which one it wants. History is not rewritten.

---

**Total deviations:** 3 (1 blocking, 1 test expectation, 1 trailer). **Impact:** none on scope.

## Non-owned test edits

None. `git diff --stat $BASE..HEAD -- test ':!test/bridges/commands'` prints nothing. `npm run test:modules` passes.

## Verification

- `node --test test/bridges/commands/staged-command.test.ts test/bridges/commands/stage.test.ts`: 51 pass.
- `npm run test:coverage:direct -- .../staged-command.ts .../stage.ts`: no shortfall.
- `npx cucumber-js features/slash-command`: 18 scenarios pass (194 steps), including plan 03-01's listing scenarios.
- `npx cucumber-js features/plugin/component-directories.feature features/plugin/staging-warnings.feature features/skill/aliases.feature features/skill/collisions.feature`: 43 pass.
- `npm run check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features): pass after Tasks 1 and 3. `npx fallow dupes --fail-on-issues --format human --quiet`: pass. `npm run check:features`: pass after each task.
- `npm run check` (full) was not run in this worktree. Four executors share the machine; the post-merge gate runs it on the combined tree.

## Issues Encountered

- Inside the worktree, the commit hook printed "(no files to check)" for `npm run check:commit` and prettier. I ran `npm run check:static`, the owner tests, and direct coverage by hand before the commits.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-03-04 is mitigated: each field Pi cannot honor is named at install (the tracer and the all-eight scenarios, plus negative edits A and B). T-03-05 holds: the line names the source name and the keys only, never a value.

## Dubious Choices

1. **`--` for Pi's em dash.** A description that itself contains an em dash or `--` cannot be told apart from the join in the menu table. A reviewer might prefer separate `argument hint` and `description` columns, but Pi's own join (`hint`, `desc`, or `hint — desc`) is ambiguous when either part is missing, so the parse would guess.
2. **The menu table includes `demo:demo-skill`.** That is Phase 2's alias suggestion, so a change in the skills alias provider changes this scenario. The rule that a table lists every row makes it a required row.
3. **The parser slices fixed 120-column rows from the last `→ `.** It depends on the PTY width in `pi-tui-pty.py` and on Pi padding every row to full width. A future Pi that pads differently, or a menu longer than its visible window (a scroll line), needs a parser change.
4. **`[t]` is pinned as Pi renders it.** It is Pi's source tag for an extension-discovered template, not something this extension controls.
5. **Existing unit cases changed their expected values instead of their inputs.** The D-CF3-08 rows and the BOM case keep `model: sonnet` and now also expect the line. Changing the input to an honored field would keep them focused on the description, but the plan prefers inputs unchanged.

## Parent lines

- **CHANGELOG.md (suggested line):** "Installing a plugin now names, for each slash command, the frontmatter fields Pi cannot honor (`model`, `effort`, `agent`, `context`, `background`, `hooks`, `paths`, `disallowed-tools`) as a note."
- **PROJECT.md Key Decisions:** none.
- **CONVENTIONS.md "Suppressions":** unchanged (no `fallow-ignore` marker added or removed).
- **Plan 03-08:** reuse `the user types the slash command prefix {string} in pi's terminal` and `pi's terminal menu offers these slash commands:`; an em dash in the expected text is written `--`.
- **Plan 03-03:** the scenario "A command that is not user-invocable runs when the user types it" expects the user row `Run the hidden check.` with no arguments typed. It must stay green once the invocation handler merges.

## Next Phase Readiness

- CMD-03 is proven for the fields that do not depend on `description`. Plan 03-08 can add a manifest `argumentHint` scenario with these menu steps.

## Self-Check: PASSED

- FOUND: `features/slash-command/frontmatter.feature`, `features/step_definitions/slash-command/frontmatter.steps.ts`
- FOUND commits on this branch: `6e47ebf`, `e3600a1`, `05935e3`. `git rev-list --count 0ab69e5..05935e3` = 3
- Acceptance greps: `droppedInvocationFieldsWarning(` 1; tracer title 1; `[deploy] dropped fields: model, effort` 1; `^  Scenario` 7; system-prompt step 1; `/demo:hidden` 2; `slash command prefix` 1; `<environment>` 2; `git diff --stat $BASE..HEAD -- features/lib/pi-tui.ts` empty

---
*Phase: 03-slash-commands*
*Completed: 2026-11-01*
