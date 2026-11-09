---
phase: 01-foundation
plan: 07
subsystem: testing
tags: [cucumber, harness, pi-json-mode, pi-tui, terminal-screen, browse-picker]

requires:
  - phase: 01-foundation
    provides: "01-02: piArguments(\"json\"), ScenarioWorld.oneShotPiLaunch(), and the exported claudePluginPayloads"
provides:
  - "runJsonModeCommand(launch, command, timeoutMs?) in features/lib/pi-json-mode.ts: one command in a one-shot Pi in json mode, payloads validated as DRV-01 requires (D-BG-09)"
  - "terminalScreen(output, rows, columns), PiTuiSession.screenLines(), and PiTuiSession.waitForScreen() in features/lib/pi-tui.ts"
  - "The picker driver in features/lib/plugin-picker.ts: openPicker, currentPickerScreen, choosePickerRow, cancelPicker"
  - "The picker topic module features/step_definitions/plugin/picker.steps.ts"
  - "Seeds: two BOOT-01 seeds in features/plugin/bootstrap.feature (json mode, terminal) and three BROWSE seeds in features/plugin/browse.feature"
affects: [phase 12 browse, phase 14 bootstrap, 01-08 frozen record]

actuals:
  tokens: 7300
  tasks: 3
  commits: 3
plan_head_before: 4d356143244cf30e9718344baa0f2e1630f54b6e
plan_head_after: 0aa76322b3a434c7681bd71a6a46956f56dbec8d

tech-stack:
  added: []
  patterns:
    - "A terminal step reads the current screen through a screen model that replays the output, never the output stream, so a redrawn row reads as its last value"
    - "A terminal notice is read anchored on the doc string's own first row and runs to the next blank row, dedented by Pi's common indent"

key-files:
  created:
    - features/lib/pi-json-mode.ts
    - features/lib/plugin-picker.ts
    - features/step_definitions/plugin/picker.steps.ts
    - test/architecture/pi-tui-screen.test.ts
  modified:
    - features/lib/pi-tui.ts
    - features/step_definitions/command.steps.ts
    - features/plugin/bootstrap.feature
    - features/plugin/browse.feature
    - .fallowrc.json

key-decisions:
  - "The terminal command When waits only for a quiet window; the terminal result Then waits for its anchor row before it compares, because Pi shows no sign that an extension command is running"
  - "After a picker choice that closes the picker, the driver waits for a screen row that names the plugin from the closing screen's title (`<plugin> @ <marketplace>`), then for a quiet window"
  - "terminalScreen keeps its export for its unit test through a fallow-ignore-next-line unused-export marker"

requirements-completed: [FND-01]

coverage:
  - id: D1
    description: "One command runs in a one-shot Pi in json mode and its payloads read through the rpc Then steps"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/plugin/bootstrap.feature"
        status: pass
    human_judgment: false
  - id: D2
    description: "The screen model replays pi-tui's writes, and a command's terminal notice is read from the current screen"
    requirement: FND-01
    verification:
      - kind: unit
        ref: "node --test test/architecture/pi-tui-screen.test.ts test/architecture/pi-tui-notices.test.ts"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/plugin/bootstrap.feature features/marketplace/background-update.feature features/skill/aliases.feature"
        status: pass
    human_judgment: false
  - id: D3
    description: "The browse picker opens, lists its rows, chooses, and cancels in a real terminal"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/plugin/browse.feature"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-11-08
status: complete
---

# Phase 1 Plan 07: Json, Terminal, and Picker Drivers Summary

**The streams can now run one `/claude:plugin` command in a one-shot Pi in json mode and read its payloads with the rpc `Then` steps, run a command in a real terminal and compare the extension's notice read from the current screen, and drive the browse picker there: list a screen's rows, choose a row by its label, and cancel. A screen model replays what pi-tui writes, so a redrawn row reads as its last value. Five seeds prove the drivers.**

## Performance

- **Duration:** about 40 min
- **Started:** about 2026-11-08T04:30Z
- **Completed:** 2026-11-08T05:10Z
- **Tasks:** 3
- **Files modified:** 9 (4 created)

## Accomplishments

- `runJsonModeCommand` spawns `process.execPath` with `piArguments("json", [scripted model])`, `--provider faux --model faux-1`, and the command as the last argument. It runs in the sandbox project, detached, with `rpcChildEnvironment(sandbox, git, environment)` and stdin closed. On exit it keeps the `entry` of each `entry_appended` record whose entry type is `custom`, and returns `claudePluginPayloads` of them. It fails, with Pi's stderr, on a non-zero exit, on no payload, and past its 25-second deadline, after it kills the process group.
- Startup payloads (assumption A3): none appeared. The json seed's result table is the rpc scenario's, with exactly one `cascade`, so the driver keeps every custom entry.
- `terminalScreen` replays printable text (one column per code point, deferred wrap at the right edge), CR, LF (scrolls on the last row), `A B C D G H f`, `J` 0/1/2/3, and `K` 0/1/2. It drops every other CSI sequence, OSC, APC (`ESC _`, which pi-tui writes for images), DCS and PM strings, two-byte escapes, a lone escape, and other C0 controls. `PTY_ROWS = 40` and `PTY_COLUMNS = 120` match `pi-tui-pty.py`. `text` is unchanged.
- The `.fallowrc.json` `ignoreExports` entry for `claudePluginPayloads` is gone (the key with it, since it held only that entry), and `npm run fallow` exits 0.

## Final step texts

- `When the user runs {string} in pi's json mode` (`command.steps.ts`)
- `When the user runs {string} in pi's terminal` (`command.steps.ts`)
- `Then pi's terminal shows this result of the command:` with a doc string (`command.steps.ts`)
- `When the user opens the plugin picker with {string} in pi's terminal` (`plugin/picker.steps.ts`)
- `When the user chooses {string} in the plugin picker` (`plugin/picker.steps.ts`)
- `When the user cancels the plugin picker` (`plugin/picker.steps.ts`)
- `Then the plugin picker shows the screen {string} with these rows:` with `label` and `description` columns (`plugin/picker.steps.ts`)

## What Pi's terminal showed

After `/claude:plugin bootstrap`, the screen held Pi's header, its `[Extensions]` list, its `No models available` warning, then the extension's notice ` ● claude-plugins-official [user] (added)` (Pi indents a status by one column and puts a blank spacer row above it), then Pi's editor frame and footer. A status replaces the previous one in place when they are consecutive (`showStatus`, interactive-mode.js 3167).

The picker takes the place of Pi's editor. Each screen is a frame: a `─` border row, the title (indented one column), the rows (`→ ` on the selected row, two spaces on the others, the description in an aligned column), the hint, and a `─` border row. The scope screen's descriptions are cut at the screen width (`...this repo on`). After `User (global)` the picker closed and the notice read `● tools [user]` / `  ● app v1.0.0 (installed)` / `/reload to pick up changes`.

## Terminal anchor and key bytes

- **Anchor:** the terminal `Then` takes the doc string's first row as its anchor. It waits until a row of the projected screen reads it (trimmed), then for a quiet window, then reads from the last such row down to the next blank row, removes the indent common to those rows, and compares the result with the whole doc string. No text Pi draws reaches the comparison. A wrong first row times out with the terminal text in the error.
- **Picker frame:** the last two all-`─` rows on the screen. A frame with fewer than two inner rows is Pi's editor, so the picker is closed. A frame whose hint is `loading…` is still loading.
- **Key bytes:** down `ESC [ B`, up `ESC [ A`, Enter `\r`, Escape `ESC`. Pi-tui read all four in the pty (assumption A4 holds). The driver waits for the target row to show as selected before it sends Enter.

## Seeds and red proofs

**BOOT-01 json, "Bootstrapping in json mode reports the result it reports over rpc":** the same result, rows, git host requests, and config `Then` steps as the first scenario of the file.

- Red proof: with the record type literal changed to `entry_appended_dropped`, the `When` failed with `/claude:plugin bootstrap in json mode emitted no claude-plugin payload`. Restored.

**BOOT-01 terminal, "Bootstrapping in the terminal shows the result it reports over rpc":** the notice `● claude-plugins-official [user] (added)` and the same two git host requests.

- Red proof (planned, cursor-up ignored): the unit case "reads a row a differential redraw rewrote as its last value" failed. The terminal seed still passed, and so did all three picker seeds. Dropping `J` and `K` as well still left the terminal seed green. The notice row is written fresh, and the anchor read stops at the blank row, so on this screen nothing stale reaches the comparison.
- Red proof (doc string): with `(added)` changed to `(skipped)`, the `Then` timed out waiting for the anchor. Restored.

**BROWSE-01, "The terminal picker lists the marketplaces of both scopes":** `tools` in the user scope and `extras` in the project scope. Rows `extras [project] | 0 plugin(s) -- {home}/marketplaces/extras` and `tools [user] | 0 plugin(s) -- {home}/marketplaces/tools`.

- Red proof: with `tools [user]` changed to `tools [project]` in the table, the `Then` failed with the whole-screen diff. Restored.
- Red proof (screen model): with `J` and `K` both dropped, this seed failed at the rows `Then`. Restored.

**BROWSE-02 choose, "Choosing a plugin in the terminal picker installs it":** choose `tools [user]`, `[available] app`, `Install`, `User (global)`, then the user record holds `app@tools | 1.0.0 | true`.

**BROWSE-02 cancel, "Cancelling the terminal picker installs nothing":** marketplaces in both scopes, open, cancel, then neither scope has an installed plugin.

- Red proof: with the cancel loop typing Enter instead of Escape, the seed failed at `Then the project scope has no installed plugins`. Four presses of Enter walked to `Project local (Recommended)` and installed `lint@extras` in the project scope. Restored.

## Task Commits

1. **Task 1: Run one command in Pi's json mode and compare its result** - `9c929bb4` (test). Tracer gate: the `<verify>` commands ran green, so the plan moved on.
2. **Task 2: Read the terminal's current screen and run one command there** - `09414ebc` (test)
3. **Task 3: Drive the browse picker in the terminal** - `0aa76322` (test)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md, and ROADMAP.md.

## Files Created/Modified

- `features/lib/pi-json-mode.ts` - created: `runJsonModeCommand` and `JsonModeLaunch`
- `features/lib/pi-tui.ts` - `ScreenModel`, `terminalScreen`, the PTY size constants, `screenLines()`, `waitForScreen()`
- `test/architecture/pi-tui-screen.test.ts` - created: 11 cases of the screen model
- `features/lib/plugin-picker.ts` - created: the picker driver
- `features/step_definitions/command.steps.ts` - the json-mode `When`, the terminal `When` and `Then`, `terminalNotice`, the fileoverview
- `features/step_definitions/plugin/picker.steps.ts` - created: the picker topic module
- `features/plugin/bootstrap.feature` - two seeds and one description sentence
- `features/plugin/browse.feature` - three seeds and one description sentence
- `.fallowrc.json` - the `ignoreExports` entry removed

## Decisions Made

- `JsonModeLaunch` is a structural interface in the driver with the same members as the world's `OneShotPiLaunch`, because a library does not import the world.
- The terminal `When` waits for a 1-second quiet window (20-second deadline), and the `Then` waits for its anchor. Pi shows no indicator while an extension command runs, and the `When` cannot know the notice's text.
- `waitForScreen(condition, timeoutMs, description)` is the one new wait on `PiTuiSession`. The picker driver and the terminal `Then` both use it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `fallow-ignore-next-line unused-export` on `terminalScreen`**
- **Found during:** Task 2
- **Issue:** `npm run fallow` failed with `Unused exports (1): features/lib/pi-tui.ts terminalScreen`. Only `test/architecture/pi-tui-screen.test.ts` imports it, and production dead-code analysis does not count test files. The plan requires `export function terminalScreen` in `pi-tui.ts`.
- **Fix:** Added `// fallow-ignore-next-line unused-export -- test/architecture/pi-tui-screen.test.ts pins the screen model.` above the export. **This adds one `fallow-ignore` marker, so the count in `.planning/codebase/CONVENTIONS.md` (47) is now one short.** I did not edit that document.
- **Files modified:** `features/lib/pi-tui.ts`
- **Commit:** `09414ebc`

**2. [Rule 3 - Blocking] The cancel seed adds a project-scope marketplace**
- **Found during:** Task 3
- **Issue:** `Then the project scope has no installed plugins` fails when the project scope has no `state.json` ("does not exist, which is not an empty record").
- **Fix:** The cancel seed also adds `extras` to the project scope, as the BROWSE-01 seed does. Then cancelling has something in each scope to leave alone.
- **Files modified:** `features/plugin/browse.feature`
- **Commit:** `0aa76322`

---

**Total deviations:** 2 auto-fixed (both Rule 3). **Impact on plan:** one suppression marker; no scope change.

## Issues Encountered

- **Possible product discrepancy, not a blocker:** the picker's marketplace row reads `0 plugin(s)` for a marketplace that offers plugins. `edge/handlers/plugin/browse.ts:69` counts `Object.keys(record.plugins)`, the plugins installed from that marketplace, not the plugins it offers. The BROWSE-01 seed pins what the product shows today. Phase 12 (BROWSE-01) should check this against Claude Code's picker before it keeps the value.
- Without cursor-up, none of the five seeds fails. Only the unit case catches it. See the red proofs above.
- The session's worktree guard refused compound shell commands that named git, so edits went through the Edit tool, and each git command ran on its own.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 12 owns `features/plugin/browse.feature` and can add verb steps in `plugin/browse.steps.ts`. That module does not exist yet, as the layout reserves it.
- Phase 14 can compare bootstrap across rpc, json, and terminal with the steps above.
- 01-08's frozen-list check should note that `.fallowrc.json`, `features/lib/pi-tui.ts`, and `command.steps.ts` changed in this plan.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-1-17: the json Pi's environment comes from `rpcChildEnvironment`, the sandbox from `resolveRpcSandbox`, and its stdin is `ignore`. T-1-18: the json driver kills its process group past its deadline, and the terminal Pi's stop is registered at start by `startTuiSession`. No Pi or pty process was left running after the runs. T-1-19: the unit cases pin each sequence, and the BROWSE-01 seed fails when erase in display and in line are dropped.

## Dubious Choices

- **Terminal `When` completion signal (Medium):** the plan asked the `When` to wait until the screen shows the notice. The `When` cannot know the notice's text, so it waits only for a quiet window, and the `Then` waits for its anchor row. A step placed between them that reads disk, such as the git host log, could run before a slow command finishes.
- **Anchor is the doc string's first row (Medium):** the notice is found by the expected first row. A wrong first row shows as a 20-second timeout with the terminal text, not as a row diff. The read stops at the first blank row, so a notice with an internal blank row would be cut there.
- **Picker close wait (Medium):** after a closing choice, the driver waits for a screen row with the plugin's name as a word, taken from the closing screen's title (`<plugin> @ <marketplace>`). That depends on the extension's title format and on its notices naming the plugin on a row of their own.
- **Picker frame detection (Low):** the picker is the last two all-`─` rows on the screen. A frame with fewer than two inner rows is Pi's editor. This works because the picker takes the place of the editor.
- **Label and description split (Low):** a row is split at its first run of two or more spaces. A label with two spaces in it would split wrong.
- **`0 plugin(s)` pinned (Medium):** see Issues Encountered. The seed pins the current product value and reports it, without deciding whether it is right.
- **Fallow marker over a test-only export (Low):** the other choice was to move `terminalScreen` into its own module, but the plan names `pi-tui.ts` as its home.
- **Screen model scope (Low):** tabs, backspace, save and restore of the cursor (`ESC 7`/`8`, `CSI s`/`u`), and wide characters are not modeled. Pi-tui wrote none of them in these runs, and the plan asked for one column per code point.
- **25-second json deadline (Low):** it stays below the 30-second step timeout, so a hung Pi fails with its stderr and not as a bare step timeout.

## Self-Check: PASSED

- FOUND: `features/lib/pi-json-mode.ts`, `features/lib/plugin-picker.ts`, `features/step_definitions/plugin/picker.steps.ts`, `test/architecture/pi-tui-screen.test.ts`; `features/step_definitions/plugin/browse.steps.ts` is absent
- FOUND: commits `9c929bb4`, `09414ebc`, `0aa76322` on `features/behavioral-gaps`
- Plan verification: `npm run test:cucumber:profile -- --profile adapter features/plugin/bootstrap.feature features/plugin/browse.feature features/marketplace/background-update.feature` (30 scenarios passed); the Task 2 set with `features/skill/aliases.feature` (36 passed); `node --test` of the two screen tests (15 pass, 0 fail); `npm run check:features`, `npm run typecheck`, ESLint on the changed files, `npm run fallow` (exit 0), and `npm run test:unpaired` (exit 0)

---
*Phase: 01-foundation*
*Completed: 2026-11-08*
