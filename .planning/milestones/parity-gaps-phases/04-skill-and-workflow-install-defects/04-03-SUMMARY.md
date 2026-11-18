---
phase: 04-skill-and-workflow-install-defects
plan: "03"
subsystem: bridges/skills (staging), domain (sibling skill paths), cucumber skill features
status: complete
tags: [PG-SKILL-04, D-PG4-03, D-PG4-04, D-PG4-05, D-PG4-06, D-PG4-07, skills, cucumber]
requires:
  - "04-01: the marketplace-root file step and the root-source skills rule"
provides:
  - "rewriteSiblingSkillPaths(content, input) and SiblingSkillPathInput in extensions/pi-claude-marketplace/domain/skill-sibling-paths.ts"
  - "A required siblingSkills member on the module-private SkillStagingContext, built in prepareStageSkills from discovery"
  - "features/skill/sibling-links.feature (3 scenarios)"
affects:
  - "04-06 (lists the agent-preload residual as a BACKLOG line)"
tech-stack:
  added: []
  patterns:
    - "One closure (skillMarkdownRewrite) runs SKTK-01 references, then sibling paths, for SKILL.md and every supporting .md"
    - "A sticky regex checks the text right after a token, so the token pattern never backtracks to a shorter path"
key-files:
  created:
    - extensions/pi-claude-marketplace/domain/skill-sibling-paths.ts
    - test/domain/skill-sibling-paths.test.ts
    - features/skill/sibling-links.feature
  modified:
    - extensions/pi-claude-marketplace/bridges/skills/stage.ts
    - test/bridges/skills/stage.test.ts
decisions:
  - "D-PG4-07 reading: prepareStageSkills builds the sibling map from its own discovery. StageSkillsInput gains no field and no orchestrator changes, so install, update, reinstall, and apply all get the map"
  - "rewriteSupportingMarkdown takes one rewrite closure in place of pluginName and names, so its parameter list shrinks from four to three"
  - "The root-source scenario puts its two links in a supporting file of skill a, so it is red before the supporting-file wiring, as the acceptance criterion asks"
metrics:
  duration: "~45 min"
  completed: 2026-11-13
estimate:
  tokens: 58000
  tasks: 2
actuals:
  tokens: 10900
  tasks: 2
  commits: 2
plan_head_before: 81fd8abdcbfee336b68d8fa406f11f2733c36443
plan_head_after: 3e72ad4d653aca1b06504314982cb795f4ed984a
---

# Phase 4 Plan 03: Sibling skill links Summary

A relative link from a staged skill to a sibling skill of the same plugin now names the folder the sibling is staged in. For example, `../b/ref.md` in skill `a` of plugin `demo` becomes `../demo-b/ref.md`. The rewrite applies to the staged `SKILL.md` and to every supporting `.md` file at any depth (PG-SKILL-04).

## What changed

- `extensions/pi-claude-marketplace/domain/skill-sibling-paths.ts` (new, imports only `node:path`, no filesystem call)
  - `rewriteSiblingSkillPaths(content, { fileSourceDir, skillSourceDir, siblingSkills })` runs one regex per line and returns each token unchanged on any miss.
  - An empty sibling map returns the content unchanged right away.
- `extensions/pi-claude-marketplace/bridges/skills/stage.ts`
  - `SkillStagingContext.siblingSkills` (required). `prepareStageSkills` builds it as `path.resolve(skill.skillDir)` to `generatedName` for each `discovered` skill. A skill that discovery drops (collision loser, command-shadowed, unlisted root-source folder) is not in the map, so its links stay as written.
  - New `skillMarkdownRewrite(context, skill, stagedDir)`. It returns a closure that runs `rewriteMarkdownReferences` and then `rewriteSiblingSkillPaths`. The file's source folder is `path.join(skillSourceDir, path.relative(stagedDir, stagedFileDir))`, because the copy keeps the source tree.
  - `stageSkill` applies the closure to `SKILL.md` before `substituteClaudeVars` (D-PG4-05). It passes the same closure to `rewriteSupportingMarkdown(directory, skillFile, rewrite)`. The symlink skip, the skip of the own `SKILL.md`, the write-only-when-changed test, and every reasoned `no-await-in-loop` disable are unchanged. Supporting files still get no variable substitution.
- No change to `StageSkillsInput`, `bridges/skills/types.ts`, or any file under `orchestrators/`.

## Token grammar as built

```text
(?<![A-Za-z0-9_./-])(\$\{CLAUDE_SKILL_DIR\}\/)?((?:\.\.\/)+)(NAME(?:\/NAME)*)
NAME = [A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*
```

- A token cannot start right after a letter, digit, `_`, `.`, `/` or `-`. So `${CLAUDE_PLUGIN_ROOT}/skills/a/../b/x.md`, `lib/../b/x.md`, `.../b` and `x../b` are not tokens.
- A dot belongs to a name only between name characters. So `ref.md.` ends the token before the last period, and `v1.2` stays inside a name.
- Every repeat starts with a separator that its own class does not hold. So a failed match backtracks linearly: 100,000 `../` on one line take about 2.5 ms.
- The token is matched greedily and never shortened. Then a sticky `/\/\.\.?(?![A-Za-z0-9_.-])/y` checks the text right after the token. A `.` or `..` segment there (`../b/../../docs/x.md`, `../b/./x.md`) leaves the token unchanged.
- Resolution is lexical. The base is `fileSourceDir`, or `skillSourceDir` for a `${CLAUDE_SKILL_DIR}/` token. The rewrite applies the parent run, then walks the name segments and stops at the first prefix that is a key of the map. It leaves the token unchanged if there is no match, or if the first match is the own skill.
- Replacement: the variable prefix is kept, then `"../".repeat(depth + 1)` (exactly one for a prefixed token), then the generated name, then the remaining segments joined by `/`. A trailing `/` and any punctuation are outside the token, so they stay as written. The output always uses `/`.
- A path whose segments hold characters outside letters, digits, `_`, `-` and inner dots is not a token. It stays as written (the plan's flagged assumption).

## Scenarios (features/skill/sibling-links.feature, untagged, adapter profile)

1. A link from a skill to a file of a sibling skill reaches the model as a path that holds the file (task 1)
2. Supporting markdown in a subfolder links to a sibling skill through the staged folder of the sibling (task 2)
3. A root-source plugin keeps a link to a skill its entry does not list as written (task 2)

Scenario 1 uses an ordinary `./plugins/demo` plugin with skills `a` and `b`, so both stage. The user types `/demo:a`. The scripted model reads `{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-a/../demo-b/ref.md`, which is the path the text names, taken from the folder the skill block names. The Then states all four calls. Scenarios 2 and 3 state the install result fields, the plugin row, and the complete staged skills listing. Scenario 2's listing includes the `demo-skill` folder that the `offers these plugins` step publishes.

## Red and green evidence

All runs: `npm run test:cucumber:profile -- --profile adapter features/skill/sibling-links.feature`, Node v26.13.1.

- **Task 1 red** (tree at 81fd8abd plus the feature): exit 1, `1 scenario (1 failed)`, `15 steps (14 passed, 1 failed)`. The skill block said `See ../b/ref.md.`, and the read of `demo-a/../demo-b/ref.md` returned `The reference of skill b.`
- **Task 1 green** (after the domain module and the SKILL.md wiring): exit 0, `1 scenario (1 passed)`, `15 steps (15 passed)`.
- **Task 2 red, first run** (tree at 55a81f8e plus the two scenarios, before the result steps were added): exit 1, `3 scenarios (1 passed, 2 failed)`, `41 steps (39 passed, 2 failed)`. `demo-a/references/deep.md` still held `../../b/ref.md`, `` `../../b/` `` and `cat ../../b/ref.md`. `root-a/references/links.md` held `Listed: ../../b/ref.md`.
- **Task 2 red, final feature** (task-1 `stage.ts` put back in the working tree only, then restored): exit 1, `3 scenarios (1 passed, 2 failed)`, `45 steps (43 passed, 2 failed)`. It shows the same unrewritten texts.
- **Task 2 green**: exit 0, `3 scenarios (3 passed)`, `45 steps (45 passed)`.

Owner, coverage, and gate commands:

- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/skill-sibling-paths.test.ts test/bridges/skills/stage.test.ts`: 19 of 19 domain cases pass, and 44 of 44 stage cases after task 1. After task 2, 49 of 49 stage cases pass. Every case that existed before passes with its expectations unedited.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/skill-sibling-paths.ts extensions/pi-claude-marketplace/bridges/skills/stage.ts`: exit 0 after task 1. The same command for `stage.ts` gives exit 0 after task 2.
- `npm run check:features`: exit 0 after each task.
- `npx --no fallow dupes --fail-on-issues --quiet`: exit 0 after each task. `npx --no fallow health --fail-on-issues --quiet`: exit 0 after task 2.
- The commit hook (`npm run check:commit`) passed for both commits.
- Not run: the full `npm run check`. The orchestrator runs it after the wave.

## Duplication markers

I removed every `fallow-ignore-next-line code-duplication` marker from `bridges/skills/stage.ts`, `bridges/commands/stage.ts` and `bridges/skills/unstage.ts` in the working tree only, ran `npx --no fallow dupes`, and then restored all three files. One group remains, `dup:d07a267d`. It is `commands/stage.ts:154-173` with `skills/stage.ts:447-467` (unmarked numbering). It is the same span as at HEAD (`433-453` there), moved down by the 14 lines this plan added above it. The span's text did not change, so both markers stay where they are.

Observation, pre-existing and not changed: the second skills marker, above the `return { kind: "staged", ...` statement (now line 554), hides no clone group. Without any marker, fallow reports only the one group above, both at HEAD and after this plan. A later cleanup can remove that marker and its counterpart in `commands/stage.ts`, if it is also inert.

## Owner cases added

`test/domain/skill-sibling-paths.test.ts` (19 cases, whole-string equality): plain link; code span and period; trailing slash; bare folder at sentence end; depth one; depth two; variable prefix from depth two; climb through parents (`../../skills/b`); own skill from `SKILL.md`; own `SKILL.md` from `references/`; outside every skill; unstaged sibling; path-character look-behind (four forms); continued `..` and `.` segments; several tokens on several lines in link, code span, text, table cell and fenced code; inner dots in a name; empty content; empty map; 100,000 `../` with a 2-second timeout.

`test/bridges/skills/stage.test.ts`. The new helpers `writeSkillFiles`, `stageWrittenSkills` and `stageSkillFiles` take the place of the body of `stagedSkillWarnings`, which now delegates to them.

- Task 1: a sibling link in `SKILL.md` is rewritten. `${CLAUDE_SKILL_DIR}/../beta/x.md` ends as `<skillsTargetDir>/acme-alpha/../acme-beta/x.md`. A link to the collision loser `tool` stays as written.
- Task 2:
  - depth one from the file's own folder
  - depth two
  - `../SKILL.md` and `../../alpha/x.md` stay as written
  - a `.txt` file and a symbolic-linked `.md` stay as written
  - a `writeFile` spy proves the write order: `acme-alpha/SKILL.md`, then `acme-alpha/references/deep.md`, then `acme-beta/SKILL.md`. The unchanged `plain.md` is never written, and the own `SKILL.md` is not rewritten by the walk.

## Commits

- `55a81f8e` fix(skills): point a link to a sibling skill at its staged folder
- `3e72ad4d` fix(skills): rewrite sibling skill links in supporting markdown

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] lint findings caught by the commit hook**
- Task 1: `sonarjs/no-nested-template-literals` on the replacement string. It now joins `[generatedName, ...rest]` with `/`. Behavior is unchanged.
- Task 2: `@typescript-eslint/no-base-to-string` on `String(file)` in the `writeFile` spy. The spy now records the raw path argument.
- In both cases the hook stopped the commit, so no commit holds the finding.

**2. [Rule 3 - Harness] install result steps in scenarios 2 and 3**
- The world's After hook fails a scenario that leaves the result's rows unread. Scenarios 2 and 3 now state the result fields and the plugin row before the staged listing, in the shape of `features/skill/root-source-entries.feature`. The red evidence above was taken again with the final feature file.

**3. [Plan reading] where the root-source links live**
- The plan says "skill `a` links a file of `b` and a file of `c`", and it requires that scenario to be red before the supporting-file wiring. A link in `SKILL.md` would be green after task 1 already. So the two links are in `skills/a/references/links.md` (`../../b/ref.md` and `../../c/ref.md`). The `SKILL.md` arm of an unstaged sibling is proven by the owner case for the collision loser.

**4. [Plan reading] a dot segment ends the rewrite**
- "Continues with a `.` or `..` segment" is read as `/` followed by one or two dots, with no name character or dot after them. So `../b/.` at the end of a sentence also stays as written, and `../b/...` (an ellipsis) is rewritten.

No other deviation. No package was installed.

## Flagged assumptions (kept)

- **PG-SKILL-04 / unclassified edge (unresolved):** the deterministic edge probe proposed no edge for this requirement. That is not a claim of full edge coverage. The edges covered are those in the owner-case list above: depth zero, one and two; the variable prefix; a trailing slash; sentence punctuation; an own-skill path; a path outside every skill; an unstaged sibling; a path after a path character; a continued dot segment; inner dots; several tokens; a long adversarial line. This flag is neither resolved nor dismissed. The verifier reviews the list.
- The token grammar is this plan's choice. A path segment with other characters (spaces, `%`, `+`, non-ASCII) is not a token and stays as written.

## Residuals for the orchestrator

- **Agent-preload skill bodies:** `bridges/agents/skill-preload.ts` puts a skill's source body inside an agent. It does not apply this rewrite, so a `../b/` path there stays dead. The requirement names the staged `SKILL.md` and supporting Markdown only. The pure domain function makes a later fix cheap. Task 04-06-02 lists the BACKLOG line.
- Nothing in this plan was appended to the WINDOWS ledger. No stub, skipped test, or unrun verify step remains.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-04 is mitigated: the rewrite applies only when a token resolves at or inside a staged sibling of the same plugin. The new text is a parent run plus a generated name that `assertSafeName` already accepts. The function is lexical and reads no file. The outside, own-skill, unstaged, and continued-dot-segment cases each have an owner case. T-04-05 is mitigated: there is one linear pattern, applied per line, and the 100,000 `../` case finishes in about 2.5 ms under a 2-second timeout. T-04-SC: no package was installed.

## Parent lines

- PROJECT.md: record D-PG4-07 as built. The skills bridge builds the sibling map from its own discovery, and no staging input or orchestrator carries it.
- BACKLOG.md: the agent-preload residual above (owned by 04-06-02). Optional cleanup: check the second `code-duplication` marker pair on the staged `return` in `bridges/{skills,commands}/stage.ts` and remove it if it is inert.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/skill-sibling-paths.ts (`D-PG4-04` x1, `import path from "node:path"` is its only import)
- FOUND: test/domain/skill-sibling-paths.test.ts
- FOUND: features/skill/sibling-links.feature (3 `Scenario`)
- FOUND: `rewriteSiblingSkillPaths` x2 and `D-PG4-05` x2 in extensions/pi-claude-marketplace/bridges/skills/stage.ts
- FOUND: 55a81f8e, 3e72ad4d (ancestors of HEAD); `git rev-list --count 81fd8abd..HEAD` = 2
- No diff in bridges/skills/types.ts or under orchestrators/ across the plan's commits
