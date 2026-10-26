---
phase: 08-plugin-reinstall
reviewed: 2026-10-23T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - features/plugin/reinstall.feature
findings:
  blocker: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-10-23
**Depth:** standard
**Files Reviewed:** 1 (the four scenarios at `features/plugin/reinstall.feature:157-210`)
**Status:** issues_found

## Summary

The scope is the four scenarios that Phase 8 appended to `features/plugin/reinstall.feature`. The review used the cucumber skill (`SKILL.md`, `rules/features.md`, `rules/layout.md`), REI-01..REI-03, the ROADMAP Phase 8 criteria, and `08-CONTEXT.md`.

Step mechanics were checked first, and they hold:

- `the result has these fields:` compares the whole envelope. `namesLike` adds every field the table leaves out (`command.steps.ts:75-81`, `field-rows.ts:78-83`).
- `the result lists these plugins:` compares every row and every column (`recordTable`).
- `lastResult()` fails unless there is exactly one payload (`world.ts`).
- The `After` hook fails a passing scenario that leaves rows or session results uncompared.
- `the installation record ... holds these plugins:` sorts and compares every record (`installation.steps.ts:267-276`).
- `the session offers no skills` compares against `[]`.
- `declares these plugins` and `does not exist` compare the whole map and check that the file is absent.

So no table compares only a sample. The gaps are in what the scenarios observe, not in how the steps compare.

`npm run check:features` passes (exit 0). As briefed, `npm run test:cucumber` and `npm run check` were not run.

The main gap is in REI-01. No reinstall scenario checks the artifacts after a reinstall over artifacts that are still on disk. The replace path for existing targets is the move-aside, rename-in, and remove-backup sequence (`reinstall-replace.ts:505-540`, `bridges/skills/stage.ts:427-483`). The only artifact check reaches it with the targets already deleted, which is the ENOENT-tolerant branch.

## Critical Issues

### CR-01: The REI-01 scenario does not observe the artifacts it claims to rebuild

**Severity:** BLOCKER
**File:** `features/plugin/reinstall.feature:157-168`

**Issue:** The title is "Reinstalling an installed plugin rebuilds it at the same version in the same scope". REI-01 says reinstall "rewrites its artifacts at the same version". The scenario checks three things: the result envelope, the result row, and the installation record (id, version, enabled). The command's messaging produces the first two, and the third is the same record the Background already wrote. Nothing the reinstall leaves on disk is checked.

A plausible wrong implementation passes. Suppose the replace path loses the live skill when a target already exists: the backup cleanup removes the renamed-in copy, or the rename collides with the moved-aside directory. It still reports `reinstalled`, and the record is unchanged. That implementation passes this scenario. It also passes the Phase 1 seed at line 142, because the seed deletes the skills first. The seed therefore drives only the ENOENT branch of `bridges/skills/stage.ts:454/483` and never the move-aside branch. A reinstall that writes nothing at all also passes this scenario. Only the seed catches that case.

The install and update features each pair the report scenario with a session scenario: `install.feature:24` "A new session offers the skills of the installed plugin" and `update.feature:28` "A new session offers the skills of the updated version". Reinstall has no such pair for intact artifacts.

**Fix:** Add the matching session scenario. It uses only existing steps:

```gherkin
  Scenario: A new session offers the skills of the reinstalled plugin
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
```

You can also end CR-01's scenario with the whole staged-resources table, as `state-lock.feature:30` does:

```gherkin
    Then the project scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |
```

## Warnings

### WR-01: "changes nothing" in the REI-03 scenario leaves the staged artifacts unchecked

**Severity:** WARNING
**File:** `features/plugin/reinstall.feature:190-210`

**Issue:** The title says the failed reinstall "changes nothing". The scenario proves this for three of the places the command writes: the installation record, `claude-plugins.json`, and the absence of `claude-plugins.local.json`. It does not check the staged resources, which are what a session offers. Two wrong implementations pass:

- One stages `pp-skill` (or rewrites or drops `demo-skill`) before it refuses the not-installed target, and does not roll back.
- One runs the post-command maintenance on the wrong plugin.

Both are less likely than CR-01's case, because the reinstall flow resolves its targets from the record before it stages anything. That is why this is a WARNING and not a BLOCKER. Still, the title claims more than the scenario checks. The state-lock failures in `state-lock.feature:30` and `:57` use the record + config + staged-resources set for the same claim.

**Fix:** Add after line 210:

```gherkin
    Then the project scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |
```

### WR-02: No reinstall scenario checks that the record still names the reinstalled artifacts

**Severity:** WARNING
**File:** `features/plugin/reinstall.feature:166-168` (step: `features/step_definitions/plugin/installation.steps.ts:267-276`)

**Issue:** `the installation record ... holds these plugins:` compares id, version, and enabled. It reads `resources.skills` (`installation.steps.ts:136-147`) but never compares it, and an empty list passes. Suppose a reinstall rewrites the record from the new handles and leaves `resources.skills` empty. Every reinstall scenario passes. A later `uninstall` then cannot find the skill by its recorded name and leaves it staged, so the leak shows up only one command later.

**Fix:** The installation-record step is foundation-owned, and the layout rules forbid this phase to edit it. Use a reinstall scenario built from existing steps instead:

```gherkin
  Scenario: Uninstalling a reinstalled plugin removes its skills
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope project"
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the result has these fields:
      ...
    Then the result lists these plugins:
      ...
    Then the project scope has no installed plugins
```

Another option is a follow-up foundation change that compares `resources.skills` in the record step.

## Info

### IN-01: The REI-02 precondition scenario proves its point only through its pairing with the Phase 1 seed

**Severity:** INFO
**File:** `features/plugin/reinstall.feature:185-188`

**Issue:** "A new session offers no skills of a plugin whose installed skills were deleted" runs no reinstall. It belongs in `reinstall.feature` only because it makes the seed at line 142 non-vacuous. Suppose a session restored deleted skills on its own, through a reconcile self-heal. Then the seed would pass even with a no-op reinstall, and this scenario is what fails in that case. The design is sound (D-03) and REI-02 asks for it. A reader of the file cannot see that link without the context document.

**Fix:** Optional. Name the link in the title, for example "Deleting a plugin's installed skills removes them from a new session until a reinstall". Or keep the title and accept the split as recorded in D-03.

### IN-02: "in the same scope" is shown only by the project-scope record and row

**Severity:** INFO
**File:** `features/plugin/reinstall.feature:157-168`

**Issue:** The scenario shows that the project scope still holds `demo@fixtures`. It does not show that the reinstall left the user scope alone. A reinstall that also recorded or staged the plugin in the user scope would pass. With `--scope project` given explicitly this is unlikely. Also, the record steps fail on a scope with no `state.json`, so the step for an absent user scope may not apply.

**Fix:** None required. If a user-scope check becomes cheap, add one, such as `the user scope has no installed plugins` when the user scope has a record.

---

_Reviewed: 2026-10-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
