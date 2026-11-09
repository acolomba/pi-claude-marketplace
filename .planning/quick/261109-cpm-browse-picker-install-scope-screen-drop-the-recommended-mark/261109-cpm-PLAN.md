---
quick_id: 261109-cpm
description: drop the recommended marker from the browse picker's install-scope screen (BROWSESCOPE-01, supersedes D-BG-1202)
date: 2026-11-09
mode: quick-batch
phase: quick-261109-cpm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - features/plugin/browse.feature
  - test/edge/browser/plugin-browser.test.ts
  - extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts
  - .agents/skills/cucumber/rules/layout.md
autonomous: true
requirements: [BROWSESCOPE-01]

must_haves:
  truths:
    - "In Pi's terminal, the install-scope screen of an available plugin lists `Project local`, `Project`, and `User (global)`, in that order, and no row carries the `(Recommended)` marker"
    - "Each scope-screen description keeps its text and its 84-character cut in the 120-column terminal: pi-tui's SelectList gives the label column a fixed 32 cells when no layout is passed, so a shorter label does not move the descriptions"
    - "Choosing `Project local` still installs in the project scope with `local: true` and declares the plugin in `claude-plugins.local.json` only; `Project` declares it in `claude-plugins.json` only; `User (global)` installs it in the user scope"
    - "The two scope-screen scenarios of `features/plugin/browse.feature`, the `User (global)` install (now titled with D-BG-1203) and the `Project local` install, fail on the unchanged source and pass with the change, and the SUMMARY records both runs"
    - "PROJECT.md records D-BG-1203 (drops the marker, keeps the order) on the line after D-BG-1202, whose outcome reads `Superseded 2026-11-09 by D-BG-1203`; BROWSESCOPE-01 stays open with a `Narrowed 2026-11-09 (quick 261109-cpm, D-BG-1203)` paragraph that names Claude Code's order and option wording as what remains"
    - "The CHANGELOG `[Unreleased]` entry has one sub-bullet for the change, and no README and no file under `docs/` names the removed marker"
  artifacts:
    - path: extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts
      provides: "the install-scope SelectList whose first item is labeled `Project local`"
      contains: 'label: "Project local",'
    - path: test/edge/browser/plugin-browser.test.ts
      provides: "the exact scope-screen rows case, which expects `Project local` first"
      contains: '"Project local",'
    - path: features/plugin/browse.feature
      provides: "the scope-screen rows and the `Project local` choice without the marker"
      contains: "| Project local | Install in the local config"
    - path: .planning/PROJECT.md
      provides: "the D-BG-1203 decision row"
      contains: "**D-BG-1203 ("
  key_links:
    - from: "showInstallScope first item (edge/browser/plugin-browser.ts)"
      to: "the onSelect commit with scope project and local true"
      via: "the item value project-local, which this change leaves as is"
      pattern: 'value: "project-local"'
    - from: "the browse.feature step that chooses Project local in the plugin picker"
      to: "choosePickerRow (features/lib/plugin-picker.ts)"
      via: "an exact, unique match on the label text the screen shows"
      pattern: "labels\\.indexOf\\(label\\)"
---

<objective>
Drop the `(Recommended)` marker from the `Project local` row of the browse picker's install-scope screen, and keep the three rows in their order: `Project local`, `Project`, `User (global)`. The user asked for this in the 2026-11-09 review of the behavioral-gaps dubious choices (P12-DC-04, "fix before the PR"). The new decision D-BG-1203 supersedes D-BG-1202, which kept the rows as they were. The rest of BROWSESCOPE-01 stays open: Claude Code 2.1.319 lists user, project, then local, in its own wording.

Purpose: Claude Code marks none of its scope options recommended. The user kept Pi's order, and D-BG-1203 records that choice as the license for the order that still differs.

Output: Task 1 (tracer) changes the label in the source and the rows that the unit test and the two scope-screen scenarios pin, with red runs before the source edit. Task 2 records D-BG-1203, narrows BROWSESCOPE-01, and adds the CHANGELOG sub-bullet.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
Rules: AGENTS.md (Git, GSD records, Build verification, Behavioral tests); `.agents/skills/cucumber/SKILL.md` and `rules/features.md`; `.agents/skills/typescript-unit-tests/SKILL.md` and `rules/cases.md`; `.agents/skills/typescript-style/rules/comments.md`; `.agents/skills/local-verification/SKILL.md`, `rules/commands.md`, and `rules/gates.md`; `.agents/skills/committing/SKILL.md`; `.agents/skills/changelog/SKILL.md` and its rules.

Sources: the BACKLOG entry `## BROWSESCOPE-01`; the PROJECT.md row D-BG-1202; `.planning/DUBIOUS-CHOICES.md` (P12-DC-04, "fix before the PR"); `.planning/milestones/behavioral-gaps-phases/12-browse-picker/` (12-CONTEXT.md D-BG-1202, DUBIOUS-CHOICES.md P12-DC-04, P12-DC-11, P12-DC-18, P12-DC-19).

Planner measurements at BASE `9a398226` (the batch base), 2026-11-09:

- The `(Recommended)` marker appears in exactly three files: `extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts` once (line 468), `test/edge/browser/plugin-browser.test.ts` three times (lines 490, 515, 613), and `features/plugin/browse.feature` twice (lines 100, 142). No file under `docs/` or `demos/`, and neither `README.md`, `README.es.md`, nor `CHANGELOG.md`, names it. (`docs/research/issue-101-skill-frontmatter-diagnosis.md` calls a skill frontmatter field *Recommended*, which is unrelated.) No demo tape shows the scope screen.
- pi-tui has one installed copy, `node_modules/@earendil-works/pi-tui` 1.5.0. `plugin-browser.ts` line 485 builds the scope list as `new SelectList(items, items.length, this.listTheme())`, with no layout, so `getPrimaryColumnBounds` gives min = max = `DEFAULT_PRIMARY_COLUMN_WIDTH` (32). A render of the three rows at 120 columns with the real `SelectList` puts every description at column 34 and cuts it at 84 visible characters, with the old first label and with `Project local` alike. The scenario's description cells are those 84 characters (P12-DC-11), so they do not change.
- The picker driver splits a screen row at its first run of two or more spaces (`features/lib/plugin-picker.ts` lines 55-67), and `choosePickerRow` fails unless exactly one row has the label (lines 141-147), so `Project local` and `Project` stay distinct.
- Each `--name` pattern in Task 1 selects exactly one scenario under `features/`. The renamed unit case title appears in no file but its own.
- Upstream: function `xu` in the Claude Code 2.1.319 binary (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude`, the only installed version, re-read 2026-11-09) builds `Install for you (user scope)`, `Install for all collaborators on this repository (project scope)`, and `Install for you, in this repo only (local scope)`, then the link rows and `Back to plugin list`. No option is marked recommended.
- Precedents: commit `15d5b81b` updated the Phase 12 seeds line of `.agents/skills/cucumber/rules/layout.md` when a browse seed title changed. BACKLOG BLTOWNER-01 shows the `Narrowed <date> (quick <id>): ...` paragraph for an entry that stays open. PROJECT.md marks a replaced decision `Superseded <date> by <ID>` in its outcome cell.
</context>

## Record texts

Task 2 writes these texts. They sit outside the task actions on purpose, because Task 1's gate searches the code files for the marker.

R1, the new PROJECT.md row, one line, inserted right after the D-BG-1202 row:

```text
| **D-BG-1203 (behavioral-gaps, quick 261109-cpm, decided by the user on 2026-11-09, see DUBIOUS-CHOICES.md P12-DC-04): the install-scope screen drops `(Recommended)` and keeps its order**: `Project local`, `Project`, `User (global)`. It supersedes D-BG-1202. | Claude Code 2.1.319 marks none of its scope options recommended (function `xu` in the binary). The user kept Pi's order, so the order and the option wording still differ from Claude Code's, which lists `Install for you (user scope)` first. BACKLOG BROWSESCOPE-01 carries both. | ✓ Good |
```

R2, the D-BG-1202 row: its last cell `-- Revisit` becomes `Superseded 2026-11-09 by D-BG-1203`. The decision and rationale cells stay byte for byte.

R3, a new paragraph at the end of the BROWSESCOPE-01 entry, after its `Noted 2026-11-08 ...` paragraph and a blank line:

```text
Narrowed 2026-11-09 (quick 261109-cpm, D-BG-1203): at the user's request, the picker no longer marks `Project local` as `(Recommended)`. It still lists `Project local`, `Project`, and `User (global)`, in that order. Two differences stay open: Claude Code's order (user, project, local) and its option wording. Candidate direction: reorder the screen to user, project, project local, and update the scope-screen rows that the `Choosing User (global) in the terminal picker ...` scenario of `features/plugin/browse.feature` pins.
```

R4, the CHANGELOG sub-bullet (18 words), indented two spaces under the `## [Unreleased]` entry:

```text
  - The browse picker no longer marks `Project local` as `(Recommended)` when it asks where to install a plugin.
```

## Out of scope

- Reordering the screen to Claude Code's user, project, local, and Claude Code's option wording: the rest of BROWSESCOPE-01, which stays open.
- `.planning/DUBIOUS-CHOICES.md`: marking P12-DC-04 fixed is a parent line. Six batch items would each change adjacent lines of its list.
- `.planning/STATE.md` and `.planning/ROADMAP.md`: the quick-batch workflow records the task.
- The archived Phase 12 files under `.planning/milestones/`: history, unchanged.

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: The install-scope screen shows `Project local` with no marker, in the same order, end to end (D-BG-1203)</name>
  <reversibility rating="reversible">One label string and the rows that pin it; restoring the marker is the same small edit.</reversibility>
  <precondition>The executor's checkout has `node_modules/.init-done`; if it does not, run `bash scripts/init.sh` there before the first check.</precondition>
  <files>features/plugin/browse.feature, test/edge/browser/plugin-browser.test.ts, extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts, .agents/skills/cucumber/rules/layout.md</files>
  <read_first>
- extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts lines 462-520: `showInstallScope`, its three items (label, value, description), and the `onSelect` mapping.
- test/edge/browser/plugin-browser.test.ts lines 490-524 (the case that chooses the first scope row and expects `local: true`) and lines 595-630 (`PluginBrowser :: scope screen names the config each choice installs into`, which pins the exact label and description of each row at width 200).
- features/plugin/browse.feature lines 84-110 (the `User (global)` install scenario and its `Install app @ tools: Select Scope` rows table) and lines 132-150 (the `Project local` install scenario).
- features/lib/plugin-picker.ts lines 51-68 and 137-160 (row parsing, and the exact, unique label match of `choosePickerRow`).
- node_modules/@earendil-works/pi-tui/dist/components/select-list.js: `getPrimaryColumnWidth`, `getPrimaryColumnBounds`, and `renderItem`.
- .agents/skills/cucumber/rules/layout.md line 214 (the Phase 12 seeds entry, which quotes the `User (global)` scenario's title).
- .agents/skills/cucumber/rules/features.md (Scenarios; Data tables: align the columns), .agents/skills/typescript-unit-tests/rules/cases.md, .agents/skills/typescript-style/rules/comments.md (test titles), .agents/skills/local-verification/rules/commands.md, and .agents/skills/committing/SKILL.md.
  </read_first>
  <behavior>
- The scope screen's rows, top to bottom: `Project local` with `Install in the local config (.pi/claude-plugins.local.json, gitignored, this repo only)`; `Project` with `Install in the base config (.pi/claude-plugins.json, for all collaborators on this repo)`; `User (global)` with `Install in the user scope's base config (~/.pi/agent/claude-plugins.json, all projects)`.
- In the 120-column terminal, each description shows cut at 84 characters, exactly as the scenario pins it today (P12-DC-11).
- Enter on the first row commits `{ action: "install", plugin, marketplace, scope: "project", local: true }`; the second commits the project scope with no `local`; the third commits the user scope.
- `the user chooses "Project local" in the plugin picker` finds exactly one row with that label.
  </behavior>
  <action>
Per D-BG-1203, which supersedes D-BG-1202. Change the scenarios and the unit test first, prove them red, then change the source.

(1) features/plugin/browse.feature:
- Line 84: the scenario title's trailing decision ID becomes `(D-BG-1203)`, so the title reads `Choosing User (global) in the terminal picker installs the plugin in the user scope (D-BG-1203)`.
- Lines 99-102, the `Install app @ tools: Select Scope` table: the first row's label becomes `Project local`. Re-pad the label column to its new widest cell, 13 characters (`Project local` and `User (global)`), so the label cells read `| label         |`, `| Project local |`, `| Project       |`, and `| User (global) |`. Keep the description column's width and every description cell byte for byte, because the fixed 32-cell label column does not move them.
- Line 142: the step becomes `When the user chooses "Project local" in the plugin picker`.
- Change nothing else in the file. The `Project` scenario and both cancel scenarios stay as they are.

(2) .agents/skills/cucumber/rules/layout.md line 214: in the second quoted title, `(D-BG-1202)` becomes `(D-BG-1203)`, so the seeds entry matches the feature file (precedent `15d5b81b`). Nothing else on the line changes.

(3) test/edge/browser/plugin-browser.test.ts:
- Line 490: the case title becomes `PluginBrowser :: available plugin offers Install -> Scope screen -> Project local commits project scope with local:true`.
- Line 515: the text the substring assertion looks for becomes `Project local`.
- Line 613: the first expected row's label becomes `Project local`. Its description and the other two rows stay.
- Add no case and no comment.

(4) RED, on the unchanged source. Record each command, its exit status, and the failing step or assertion for the SUMMARY:
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/edge/browser/plugin-browser.test.ts` exits non-zero, and the failing case is `PluginBrowser :: scope screen names the config each choice installs into`, on the first row's label. The renamed case passes on the old source too, because its substring is still on screen; say so in the SUMMARY.
- `npm run test:cucumber:profile -- --profile adapter --name 'installs the plugin in the user scope' --name 'Choosing Project local in the terminal picker'` exits non-zero with both scenarios failed. The `User (global)` scenario fails at its `Select Scope` rows step, on the first row's label. The `Project local` scenario fails at `the user chooses "Project local" in the plugin picker`, because the screen has no single row with that label. A failure on Pi's ready timeout, or at any other step, is not the red proof: rerun that scenario alone until it fails at the step named here.

(5) GREEN: in `showInstallScope` (plugin-browser.ts line 468), the first item's label becomes exactly `Project local`. Keep its `value: "project-local"` and its description, the other two items, their order, and the `onSelect` mapping as they are. Add no comment.

(6) Run this task's `<verify>` command. If the session's command guard refuses the compound line, run its parts one at a time, in order; every part must exit 0. If a description cell of the scope-screen table no longer matches, the screen layout differs from the planner's measurement: pin what the terminal shows, as P12-DC-11 did, and report it as a deviation.

(7) Commit. Run `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files features/plugin/browse.feature test/edge/browser/plugin-browser.test.ts extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts .agents/skills/cucumber/rules/layout.md`, and restage until it is clean. Stage those four paths by name, never with `git add -A`. This shell does not split a variable into several paths, so list them. Commit in the foreground, with the longest tool timeout, under the title `fix(browse): drop the recommended marker from the scope screen` and a short body that names D-BG-1203. Never use `--no-verify`. The staged files are build inputs, so the hook runs `npm run check:commit`. If the hook fails, fix, restage, and commit again without `--amend`. Do not pipe `git commit` into `tail`, which shows only the commit-msg pass. After the commit, check `git status` for files a hook rewrote. Do not push, and do not rebase.
  </action>
  <verify>
    <automated>node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/edge/browser/plugin-browser.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts && npm run test:cucumber:profile -- --profile adapter features/plugin/browse.feature && npm run check:features && ! grep -qF '(Recommended)' extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts test/edge/browser/plugin-browser.test.ts features/plugin/browse.feature && test "$(sed -n '/private showInstallScope/,/new SelectList/p' extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts | grep -o 'label: "[^"]*"' | tr '\n' '|')" = 'label: "Project local"|label: "Project"|label: "User (global)"|' && test "$(grep -cF '| Project local | Install in the local config' features/plugin/browse.feature)" -eq 1 && test "$(grep -cF 'When the user chooses "Project local" in the plugin picker' features/plugin/browse.feature)" -eq 1 && test "$(grep -o 'D-BG-12[0-9][0-9]' features/plugin/browse.feature | sort | tr '\n' ' ')" = 'D-BG-1201 D-BG-1203 ' && test "$(grep -cF 'installs the plugin in the user scope (D-BG-1203)' .agents/skills/cucumber/rules/layout.md)" -eq 1</automated>
  </verify>
  <done>The scope screen lists `Project local`, `Project`, and `User (global)`, in that order, with no marker, and each choice commits as before. The unit file, the pair's 100% direct coverage, all nine `browse.feature` scenarios under the adapter profile, and `check:features` pass. The SUMMARY records the red unit run and the red scenario run, each failing at the assertion or step named in step (4), and the green runs. One `fix(browse): ...` commit holds the four files, and its hook passed. Gate baselines measured at BASE: the marker search over the three code files finds a match (target: none); the label-order line starts with the marked label (target: the three plain labels); the aligned `Project local` row and the `Project local` choice step count 0 each (target 1 each); the feature's D-BG-12 IDs read `D-BG-1201 D-BG-1202 ` (target `D-BG-1201 D-BG-1203 `); the layout.md title with `(D-BG-1203)` counts 0 (target 1). The simulated target tree passed every one of these gates.</done>
</task>

<task type="auto">
  <name>Task 2: Record D-BG-1203, narrow BROWSESCOPE-01, and add the CHANGELOG sub-bullet</name>
  <reversibility rating="reversible">Planning and changelog text only.</reversibility>
  <files>.planning/PROJECT.md, .planning/BACKLOG.md, CHANGELOG.md</files>
  <read_first>
- .planning/PROJECT.md line 2216 (the D-BG-1202 row, whose last cell reads `-- Revisit`) and line 2215 (D-BG-1201, a row of the same form). Each row is one long line of a three-column table: decision, rationale, outcome. Find the row with `grep -n 'D-BG-1202 (' .planning/PROJECT.md`, because another batch item may have shifted the line.
- .planning/BACKLOG.md lines 5083-5085 (BROWSESCOPE-01), and the BLTOWNER-01 entry (`grep -n '^## BLTOWNER-01' .planning/BACKLOG.md`), whose `Narrowed 2026-11-06 (quick 261106-m02): ...` paragraph is the form to copy.
- CHANGELOG.md lines 1-22: the `## [Unreleased]` entry, its sub-bullet `The browse picker's marketplace rows now count ...`, and the `Internal: ...` sub-bullet after it.
- .agents/skills/changelog/SKILL.md, rules/entries.md, and rules/examples.md; the `simple-english` skill (Plain mode) and the `humanizer` skill.
- .agents/skills/readme/SKILL.md, only if the README search in step (4) finds a match.
  </read_first>
  <action>
Per D-BG-1203 and P12-DC-04. Write the texts R1 to R4 from the plan's "Record texts" section. Reword a text only to pass a self-check of the changelog, simple-english, or humanizer rules, and only if every backticked token stays.

(1) .planning/PROJECT.md: insert R1 as a new line right after the D-BG-1202 row, then apply R2 to the D-BG-1202 row. Change no other row.

(2) .planning/BACKLOG.md: append R3 to the BROWSESCOPE-01 entry, after its `Noted 2026-11-08 ...` paragraph and one blank line. Keep the heading and that paragraph unchanged; the entry stays open.

(3) CHANGELOG.md: insert R4 as a sub-bullet of the `## [Unreleased]` entry, right after the browse picker's marketplace-rows sub-bullet and before the `Internal:` sub-bullet. Indent it two spaces like its siblings, with no PR number. Check it against the changelog skill: one sentence of 25 words or fewer, no `-ing` clause after a comma, no should, would, could, or may, no semicolon, and no dash between two statements.

(4) Run the README and docs search from the `<verification>` section. The planner found no match at BASE, so no README or doc edit is expected. If the search finds one, change that text to the new rows and apply the readme skill to every README you edit.

(5) Do not edit `.planning/DUBIOUS-CHOICES.md`, `.planning/STATE.md`, or `.planning/ROADMAP.md`. The SUMMARY lists the P12-DC-04 status line for the parent.

(6) Run `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files .planning/PROJECT.md .planning/BACKLOG.md CHANGELOG.md`, and restage until it is clean. Stage the three paths by name and commit in the foreground under the title `docs(browse): record the scope screen without the recommended marker`. These files are not build inputs, so the hook skips the npm checks. Never use `--no-verify` or `git add -A`. Do not push, and do not rebase.
  </action>
  <verify>
    <automated>test "$(grep -cF '**D-BG-1203 (' .planning/PROJECT.md)" -eq 1 && test "$(grep -F '**D-BG-1202 (' .planning/PROJECT.md | grep -cF '| Superseded 2026-11-09 by D-BG-1203 |')" -eq 1 && test "$(grep -A1 -F '**D-BG-1202 (' .planning/PROJECT.md | tail -n 1 | grep -cF '**D-BG-1203 (')" -eq 1 && test "$(grep -c '^## BROWSESCOPE-01:' .planning/BACKLOG.md)" -eq 1 && test "$(awk '/^## BROWSESCOPE-01/{f=1;next} /^## /{f=0} f' .planning/BACKLOG.md | grep -cF 'Narrowed 2026-11-09 (quick 261109-cpm, D-BG-1203)')" -eq 1 && test "$(awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f' CHANGELOG.md | grep -F 'Project local' | grep -c '^  - ')" -eq 1 && SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files .planning/PROJECT.md .planning/BACKLOG.md CHANGELOG.md</automated>
  </verify>
  <done>PROJECT.md holds R1 on the line after the D-BG-1202 row, and that row ends with `| Superseded 2026-11-09 by D-BG-1203 |`, its other cells unchanged. BROWSESCOPE-01 keeps its heading and its `Noted` paragraph and gains the R3 paragraph. The `[Unreleased]` entry has the R4 sub-bullet after the marketplace-rows sub-bullet and before `Internal:`, and it passes the changelog, simple-english, and humanizer checks. The README and docs search finds nothing. Pre-commit passes on the three files, and one `docs(browse): ...` commit holds them. Gate baselines measured at BASE: D-BG-1203 rows 0, a superseded D-BG-1202 0, D-BG-1203 on the line after D-BG-1202 0, the `Narrowed 2026-11-09` paragraph 0, and `[Unreleased]` sub-bullets that name `Project local` 0 (target 1 each); the BROWSESCOPE-01 heading count is 1 and stays 1.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user keystrokes in Pi's terminal -> picker scope screen -> install handler | The row the user picks decides the install scope and the config file that declares the plugin: `.pi/claude-plugins.local.json` (gitignored), `.pi/claude-plugins.json` (shared through the repository), or the user scope's config. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-cpm-01 | Tampering | `showInstallScope` items and `onSelect` mapping (`edge/browser/plugin-browser.ts`) | low | mitigate | Only the first item's label text changes. Its value, the item order, and the mapping stay. Task 1's verify runs the unit cases that commit each row (`local: true`, project, user) and the `Project` and `Project local` scenarios, which check which config file declares the plugin and that the other one declares none. |
| T-cpm-02 | Information disclosure | a user who now picks `Project` where the marker pointed to `Project local`, so the plugin is declared in the shared config | low | accept | The user's decision (D-BG-1203). Each row's description still names its file and who shares it (`gitignored, this repo only`, `for all collaborators on this repo`), and the cursor still starts on `Project local`. |
| T-cpm-SC | Tampering | npm/pip/cargo installs | low | accept | The plan installs no package and changes no dependency file. |
</threat_model>

<verification>
- Each task's `<verify>` passes, and each commit's hook passes. The SUMMARY records Task 1's red runs (command, exit status, failing step or assertion) and its green runs.
- README and docs search, a no-change confirmation (BASE: no match): `! grep -rqF '(Recommended)' README.md README.es.md docs`. Record its result in the SUMMARY.
- AGENTS.md "Build verification": Task 1 commits build inputs, so `npm run check` must pass on the merged tree in the main checkout before the batch finishes. An executor in an isolated worktree states in the SUMMARY that the batch coordinator runs it after the merge. An executor that committed in the main checkout runs it in the foreground with the longest timeout, or in the background and waits for completion, and records the command, exit status, commit, and Node version.
- Hermetic home: every test command in this plan isolates the Pi home, through the `--import` of `test/platform/isolated-pi-home.ts` or the cucumber support module `features/support/isolated-pi-home.ts`. Never run `node --test` without that `--import`.
- `git status` is clean after Task 2, apart from the SUMMARY the executor writes.
</verification>

<success_criteria>
- The install-scope screen reads `Project local`, `Project`, and `User (global)`, in that order, with no recommended marker, and each choice installs where it did before.
- The two edited scope-screen scenarios fail without the source change and pass with it, and all nine browse scenarios pass under the adapter profile.
- The plugin-browser pair keeps 100% direct coverage, and `npm run check` passes on the merged tree at the batch gate.
- PROJECT.md holds D-BG-1203 after D-BG-1202, which reads superseded; BROWSESCOPE-01 is narrowed and stays open; the CHANGELOG `[Unreleased]` entry has the sub-bullet; no README or doc needed a change.
</success_criteria>

<output>
Create `.planning/quick/261109-cpm-browse-picker-install-scope-screen-drop-the-recommended-mark/261109-cpm-SUMMARY.md` with `status: complete` in its frontmatter. Include:
- BASE, the two commits, every red and green run (command, exit status, and the failing step or assertion of each red run), the README and docs search result, and the `npm run check` result or the statement that the batch coordinator runs it after the merge.
- `## Questionable choices`, each with the choice, the alternative, why the alternative was not taken, and a severity. At least these, plus any you made:
  - (1) A new decision ID, D-BG-1203, instead of a `D-BG-1202 reversed` row (the D-PL9-08 precedent). Chosen so that the scenario title can cite one ID.
  - (2) The `User (global)` scenario's title now cites D-BG-1203, and the layout.md Phase 12 seeds line follows it. Alternative: keep `(D-BG-1202)`, which would cite a superseded decision.
  - (3) The renamed unit case's substring assertion passes with or without the marker; the exact-rows case is the unit red proof. Alternative: a negative assertion in the renamed case. Not taken, because the exact-rows case already pins every label.
  - (4) No new scenario: the two edited scope-screen scenarios are the red proofs that AGENTS.md "Behavioral tests" asks for.
  - (5) BROWSESCOPE-01 keeps its `Noted` paragraph, which still shows the old rows, and gains a `Narrowed` paragraph (the BLTOWNER-01 form). Alternative: rewrite the first paragraph.
  - (6) `.planning/DUBIOUS-CHOICES.md` is not edited, because six batch items would change adjacent lines of its list; the status line goes to the parent.
  - (7) The cursor still starts on `Project local`, because the user kept the order (T-cpm-02).
- `## Threat Flags` (AGENTS.md), even when the answer is "None -- no security-relevant surface outside the plan's `<threat_model>` was introduced."
- `## Parent lines`: in `.planning/DUBIOUS-CHOICES.md`, mark P12-DC-04 fixed by quick 261109-cpm (D-BG-1203), both in "Decisions waiting on you" and in the Phase 12 list. No STATE.md or ROADMAP.md lines; the quick-batch workflow records the task.
</output>

## Coordinator amendments (2026-11-09, binding; they override the tasks above)

**Shared records are written by the coordinator, not by this executor.** Do NOT
edit `.planning/PROJECT.md`, `.planning/BACKLOG.md`, `CHANGELOG.md`, or
`.planning/DUBIOUS-CHOICES.md`. Every task step that writes one of them is
replaced by this: put the exact text you would have written (new decision
rows, superseded/reversed markers, BACKLOG closures or new entries, the
CHANGELOG sub-bullet) in the SUMMARY under a `## Parent lines` heading, one
sub-heading per file, ready to paste. The six batch items would otherwise all
queue on the same three files. The rest of each task (code, tests, scenarios,
other docs) runs as planned.
