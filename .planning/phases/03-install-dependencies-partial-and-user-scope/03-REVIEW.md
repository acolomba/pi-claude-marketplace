---
phase: 03-install-dependencies-partial-and-user-scope
reviewed: 2026-10-23T08:26:41Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - features/plugin/install-dependencies.feature
  - features/plugin/partial-install.feature
  - features/plugin/install.feature
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-23T08:26:41Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Scope: the 15 scenarios this phase added after the Phase 1 seeds (still staged, so
`git diff HEAD -- features/`). That is 7 in `install-dependencies.feature`
(lines 29-167), 3 in `partial-install.feature` (lines 25-82), and the last 5 in
`install.feature` (lines 194-250). I reviewed them against
`.agents/skills/cucumber/SKILL.md` and `rules/{features,layout,steps}.md`, 03-CONTEXT
D-01..D-15, INS-01..INS-04, and ROADMAP "### Phase 3" success criteria 1-4. I
read every step definition the scenarios use (`command.steps.ts`,
`session.steps.ts`, `config.steps.ts`, `plugin/installation.steps.ts`,
`lib/field-rows.ts`, `lib/result-rows.ts`, `support/world.ts`).

Gates: `npx cucumber-js` on the three files passes (29 scenarios, 292 steps), and
`npm run check:features` exits 0. Every table is column-aligned. Steps are lower
case, use only Given/When/Then, and keep every Given before the first When. The
field and row steps compare the whole envelope and every column, because
`namesLike` appends any field that the table leaves out.

To check the gaps below, I ran throwaway probe scenarios from the session
scratchpad. The repo was not touched. The probes showed that the product
currently behaves correctly in every case below. The findings are about what the
scenarios fail to protect:

- After `install demo@fixtures` with no `--scope`, the user `claude-plugins.json`
  declares `demo@fixtures` and the project one declares nothing.
- After the installed-dependency conflict, the project scope stages only
  `lib-skill`.
- After a closure install, the project `claude-plugins.json` declares only
  `app@tools`.
- After a `--partial` install, it declares `demo@fixtures`.

## Critical Issues

### CR-01: User-scope install scenarios do not check which config file declares the plugin

**File:** `features/plugin/install.feature:194-207` and `features/plugin/install.feature:209-222`
**Issue:** Both scenarios are titled "...records the plugin in the user scope
only". They check the user installation record (`state.json`) and that the
project scope has no record or staged skill. They never read either scope's
`claude-plugins.json`. The Background adds `fixtures` to the project scope, so a
plausible wrong implementation could install into the user scope but write the
declaration through the cwd's project config. The default-scope path is the
likely place for this bug. Such an implementation passes both scenarios, the
two `list --scope project` scenarios (list reads the record), and the
another-project session scenario. A later `/reload` in this project would then
reconcile the stray declaration into a project-scope install, which breaks the
"user scope only" promise of INS-04 / SC-4. A probe confirms that the product
writes the right file today, so these steps pass as they are.
**Fix:** Append to both scenarios:
```gherkin
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.json" file of the project scope declares no plugins
```

### CR-02: The installed-dependency conflict scenario does not prove that nothing of `app` was staged

**File:** `features/plugin/install-dependencies.feature:143-167`
**Issue:** The title says the install "keeps only the dependency". The scenario
proves this only through `state.json` (line 161) and `claude-plugins.json`
(line 164). It cannot use `the project scope has no installed plugins`, because
`lib` stays installed, and it puts nothing in its place. Suppose an
implementation stages `app` before it checks the installed `lib` against
`^2.0.0`, for example by walking the closure in pre-order, and its rollback then
leaves `resources/skills/app-skill` behind. That implementation passes. The two
sibling failure scenarios (lines 86 and 140) do catch a leaked staged skill, so
this scenario is the weak one. A probe confirms that the product stages only
`lib-skill` today.
**Fix:** Append:
```gherkin
    Then the project scope stages these skills and prompts:
      | kind  | name      |
      | skill | lib-skill |
```

## Warnings

### WR-01: The version-conflict failures have no `list` or new-session scenario, as SC-2 and D-07 require

**File:** `features/plugin/install-dependencies.feature:122-141` and `:143-167`
**Issue:** ROADMAP Phase 3 success criterion 2 covers both the missing-dependency
case and the version-constraint case: "...installs nothing: `list` shows no
member installed, and a new session offers none of their skills". D-07 says each
failure scenario shows "installs nothing" three ways. The missing-dependency case
gets all three (lines 69, 89, 111). Neither version-conflict case gets the
`list` or the session scenario. The disk checks partly cover this, but the
success criterion is not met as written, and a verifier reading SC-2 will find
no evidence for it.
**Fix:** Add two scenarios for the non-overlapping case. One runs
`list --scope project` after the `, which failed` setup. A probe shows the
expected rows are `app@tools`, `lib@tools`, and `mid@tools`, all `available`,
with tally success count 3. The other runs a new session and expects
`the session offers no skills`. For the installed-dependency case, add a session
scenario that offers only `/skill:lib-skill`.

### WR-02: The info scenario's title claims it names the left-out component, but it shows only the generic reason

**File:** `features/plugin/partial-install.feature:60`
**Issue:** The title "...names the component it left out" and INS-03 / SC-3
("`info` then names the component that was left out") promise that the output
style is named. The compared envelope has no field that names it. The full
field set (lines 69-82) carries only `plugin reasons | unsupported component`,
and D-09 records that `outputStyles` collapses to that reason. The scenario is
honest about the product, but its title and the requirement say more than it
proves. A reader takes the title at face value.
**Fix:** Retitle to something like
`The plugin info of a plugin installed with --partial reports it partially installed for an unsupported component`.
Then either amend INS-03 / SC-3 to "names the reason it was partial" with a
pointer to D-09, or keep the requirement open against the deferred wire field.

### WR-03: The successful closure and `--partial` installs never pin what `claude-plugins.json` declares

**File:** `features/plugin/install-dependencies.feature:29-51` and `features/plugin/partial-install.feature:25-45`
**Issue:** A probe shows that a closure install declares only `app@tools`. The
dependencies are installed but not declared, which keeps them collectible as
orphans. The scenario does not state this. An implementation that declares
`lib` and `base` too passes, and so would one that declares nothing. Either
would change what `uninstall app` and reconcile do later. The `--partial` install
is the same: `demo@fixtures` is declared, but nothing checks it. The failure
scenarios at lines 87, 141, and 164 do pin the config, so the success paths are
the gap.
**Fix:** Add to the closure scenario:
```gherkin
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        |
      | app@tools |
```
Add the matching `| demo@fixtures |` check to the `--partial` scenario. If a
dependency staying undeclared is its own behavior, give it its own scenario with
a title that says so.

### WR-04: The `list --scope project` scenarios depend on the orphan-fold rule, and they read as if the project scope had no marketplace

**File:** `features/plugin/install.feature:224-232` and `:234-242`
**Issue:** `the result lists no marketplaces` passes only because of a side
effect. `list` drops the whole project `fixtures` block, even though the
Background added it and `demo` is still installable there (D-11, the orphan-fold
rule in `list-flow.ts`). A reader who does not have D-11 in mind will read the
result as "the project scope has no marketplace". If the list phase decides the
block should show `demo` as `available`, both INS-04 scenarios break for a
reason that has nothing to do with install scope. The scenario's point, "no
installation of it", is stated only through that fold.
**Fix:** Either state the dependency in the title, for example
`...shows no plugin of the marketplace once the user scope installs it`, or
remove the coupling. To remove it, drop the project-scope Background dependency
for these two scenarios, for example by moving them to a feature without that
Background, and assert the result against a project scope whose `fixtures` block
is stated explicitly. Record the open list-rule question so the list phase
revisits both scenarios.

### WR-05: The `partial-install.feature` description no longer describes the feature

**File:** `features/plugin/partial-install.feature:3-5`
**Issue:** The description says only that installing "without --partial must
change nothing". The feature now also proves that `--partial` installs the
supported part, that a session offers its skill, and that `info` reports it.
features.md requires the description to say what the feature protects.
**Fix:** For example: "A plugin that ships a component Pi does not support is
only partially available. Installing it without --partial changes nothing, and
--partial installs only the parts Pi supports. The scenarios run the real
extension in a headless Pi and use a local marketplace in place of a published
one." (three lines).

## Info

### IN-01: INS-01 / SC-1 still say "in dependency order", which no scenario can show

**File:** `features/plugin/install-dependencies.feature:29`
**Issue:** D-03 explains that the order cannot be observed, and leaves it to unit
tests. The requirement and success-criterion text were not amended, so a
verifier may mark "dependency order" as satisfied by this scenario.
**Fix:** Amend INS-01 / SC-1 to cite the `dependency-closure.ts` and
`install-cascade.ts` unit tests for the order, or note D-03 in the
VERIFICATION evidence.

### IN-02: The failure rows leave out the member that resolved

**File:** `features/plugin/install-dependencies.feature:82-85` and `:136-139`
**Issue:** When the missing-dependency install fails, the result lists `app` and
`base` but not `lib`. When the non-overlapping install fails, it lists `app` and
`lib` but not `mid`. The scenarios pin this omission as expected, while INS-01
reads "reports each member". The disk checks prove the member was not installed.
The user, though, never sees a row for it.
**Fix:** Confirm that the omission is intended and record it as a decision. If
it is not intended, file a product bug and add the missing row with a
`dependency failed`-style reason.

### IN-03: The two version-conflict causes render the constraint differently

**File:** `features/plugin/install-dependencies.feature:139` and `:160`
**Issue:** The first cause quotes the user's ranges as typed (`"^1.0.0 ^2.0.0"`).
The second quotes a normalized range (`">=2.0.0 <3.0.0-0"`) for a constraint the
user wrote as `lib@^2.0.0`. The difference comes from
`install-cascade.messaging.ts:341`, where `failure.range` reaches the message
already normalized. The scenario faithfully pins this product inconsistency.
**Fix:** Decide which form to show. If it is the raw constraint, fix the
`installed-unsatisfied` arm's `range` source and update line 160.

### IN-04: Repeated setup and one awkward title in `install-dependencies.feature`

**File:** `features/plugin/install-dependencies.feature:8,30,54,70,90,112,123,144` and `:69`
**Issue:** All 8 scenarios open with
`Given the marketplace "tools" is published as a dir source`. That makes it
eligible for a `Background:`, though the rule does not require one. The title at
line 69, "...whose dependency chain misses a plugin...", is awkward.
**Fix:** Optionally move the publish step to a Background. Retitle line 69 to,
for example,
`Installing a plugin whose dependency chain names a plugin the marketplace does not offer fails as not in manifest and installs nothing`.

---

_Reviewed: 2026-10-23T08:26:41Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
