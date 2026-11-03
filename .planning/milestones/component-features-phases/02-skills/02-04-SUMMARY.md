---
phase: 02-skills
plan: 04
subsystem: skills-bridge
tags: [skills, cucumber, discovery, name-clash, fg-08]

requires:
  - phase: 02-skills
    provides: "bridges/skills/skill-names.ts (skillIdentityName, commandUpstreamNames) from plan 02-01"
provides:
  - "bridges/skills/discover.ts: the D-CF2-03 command shadow skip and the D-CF2-04 skills-folder-first order"
  - "features/skill/collisions.feature: the SKL-04 scenarios"
  - "features/step_definitions/skill/collisions.steps.ts: Given the user has run {string}, which skipped a skill of the plugin"
affects: [02-07, phase-3-commands]

actuals:
  tokens: 9000
  tasks: 2
  commits: 5
plan_head_before: bdf71986c61d5d8b26aa9ef9505595fecc4f6677
plan_head_after: d3eda0c76c43748146206851bdc2eda89057e16e

tech-stack:
  added: []
  patterns:
    - "One admitSkill helper holds the per-skill rules in order: safe name, MANF-03 seen directory, D-CF2-03 command shadow, D-07 generated-name dedup"

key-files:
  created:
    - features/skill/collisions.feature
    - features/step_definitions/skill/collisions.steps.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/skills/discover.ts
    - test/bridges/skills/discover.test.ts
    - test/architecture/declared-component-path-overlap.test.ts

key-decisions:
  - "The D-CF2-03 warning reads `skill source \"<dir>\" has the same name \"<plugin>:<dir>\" as a command of the plugin; ignoring the skill.` and names no path, so the install diagnostic shows it whole."
  - "The shadow skip runs after the MANF-03 seen-directory check and before the D-07 generated-name dedup: a shadowed skill claims no generated name, so `demo-clash/` still installs when `clash/` is shadowed."
  - "D-CF2-04 order is fixed in discovery only: the entry equal to `skills` moves to the front, every other entry keeps its order; `domain/component-paths.ts` is untouched."
  - "The skills-side `fallow-ignore-next-line code-duplication` marker in discover.ts is removed: the rewrite ended clone group dup:c918ae80, so the marker spanned nothing."

patterns-established:
  - "A setup Given for an install with a mixed-severity result asserts the exact (kind, severity) sequence of its payloads"

requirements-completed: [SKL-04]

coverage:
  - id: D1
    description: "A skill that shares its upstream name with a top-level command of its plugin is not staged; install shows one warning that names it; a new session lists no /skill: entry for it; /demo:clash sends the command's body"
    requirement: SKL-04
    verification:
      - kind: e2e
        ref: "features/skill/collisions.feature#A skill that shares its name with a command of its plugin is skipped with a warning"
        status: pass
      - kind: e2e
        ref: "features/skill/collisions.feature#A new session offers no skill that shares its name with a command of its plugin"
        status: pass
      - kind: e2e
        ref: "features/skill/collisions.feature#Prompting /demo:clash sends the model the command's body"
        status: pass
      - kind: unit
        ref: "test/bridges/skills/discover.test.ts#D-CF2-03: skips a skill that a command of its plugin is named, with a warning"
        status: pass
      - kind: unit
        ref: "test/bridges/skills/discover.test.ts#D-CF2-03: skips a declared skill directory a command is named, once"
        status: pass
      - kind: unit
        ref: "test/bridges/skills/discover.test.ts#D-CF2-03: a shadowed skill leaves its generated name to the next skill"
        status: pass
    human_judgment: false
  - id: D2
    description: "SKL-04 empty edge: a command of another name, a missing commands directory, or a nested command of the same basename shadows no skill"
    requirement: SKL-04
    verification:
      - kind: e2e
        ref: "features/skill/collisions.feature#A command with another name leaves the skill of its plugin listed"
        status: pass
      - kind: unit
        ref: "test/bridges/skills/discover.test.ts#D-CF2-03: <commands case> shadows no skill (3 rows)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The skills/ copy of a skill wins over a declared path's copy (E3), with the D-07 duplicate warning for the skipped copy; the D-141-04 elision clash keeps first-wins"
    requirement: SKL-04
    verification:
      - kind: e2e
        ref: "features/skill/collisions.feature#The skills folder's copy wins over a declared path's copy of the same skill"
        status: pass
      - kind: e2e
        ref: "features/skill/collisions.feature#Installing a plugin whose declared skills path repeats a skill reports the skipped copy"
        status: pass
      - kind: e2e
        ref: "features/skill/collisions.feature#Two skill directories that elide to one pi name keep the first"
        status: pass
      - kind: unit
        ref: "test/bridges/skills/discover.test.ts#D-CF2-04: (3 cases)"
        status: pass
      - kind: unit
        ref: "test/architecture/declared-component-path-overlap.test.ts"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-11-01
status: complete
---

# Phase 2 Plan 04: Skill name clashes Summary

**Skill discovery now resolves name clashes as Claude Code 2.1.316 does: a top-level command keeps a `<plugin>:<name>` that a skill directory of the same plugin also has, and the skill is skipped with an install warning (D-CF2-03). A `skills/` copy of a skill wins over a declared path's copy (D-CF2-04).**

## Performance

- **Duration:** 27 min
- **Started:** 2026-11-01T10:08:34Z
- **Completed:** 2026-11-01T10:35:48Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `discoverPluginSkills` reads the plugin's top-level command names with `commandUpstreamNames` (from `skill-names.ts`, not from the commands bridge). It skips a skill whose `skillIdentityName` is one of them and pushes `skill source "clash" has the same name "demo:clash" as a command of the plugin; ignoring the skill.`. A shadowed directory that a second path reaches again stays silent (MANF-03).
- Both collectors now admit a skill through one module-private `admitSkill` helper (safe name, then MANF-03, then D-CF2-03, then D-07). `collectSelfSkillDir` is folded into the main loop. Both complexity gates pass.
- `skillsFolderFirst` moves the conventional `skills` entry to the front of `componentPaths.skills`. The resolver is untouched. `discover-names.ts` calls the same function, so the reference inventory follows the same winners.
- `features/skill/collisions.feature` (`Feature: Skill collisions`) has 7 scenarios. They observe the install result, Pi's `get_commands` listing, and the scripted model's call log.
- Full suites on this worktree: all 1183 cucumber scenarios, `test:unpaired`, `test:integration`, `check:features`, `fallow dupes`, and direct coverage of `discover.ts` pass.

## Task Commits

1. **Task 1: A command keeps a name its plugin's skill also has, end to end** (tracer)
   - `836fa5e` test(skills): pin a command keeping the name a skill shares (RED)
   - `eaaadd6` feat(skills): skip a skill that a command of its plugin is named (GREEN)
   - `55d328a` refactor(skills): keep the shadow warning's fixed text on one line (acceptance-grep alignment)
   - Tracer gate: the full Task 1 `<verify>` chain was re-run after `55d328a`, and every step passed: unit, coverage, cucumber, and dupes.
2. **Task 2: Read the skills folder before declared skill paths, and pin the elision clash**
   - `84e0036` test(skills): pin which copy wins when two skills share a name (RED)
   - `d3eda0c` feat(skills): read the skills folder before declared skill paths (GREEN)

## Red proofs

**Task 1** (`npx cucumber-js features/skill/collisions.feature`, before `eaaadd6`, exit 1, 2 scenarios failed):

```text
1) A skill that shares its name with a command of its plugin is skipped with a warning # features/skill/collisions.feature:7
     Then the command reports these results:
       AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
       actual:   [kind, severity, needs reload] / [cascade, info, true]
       expected: [kind, severity, needs reload, header, lines] / [cascade, info, true, "", ""] /
                 [diagnostic, warning, false, 'Plugin "demo" [project] installed; 1 declared component has a note.',
                  'skill source "clash" has the same name "demo:clash" as a command of the plugin; ignoring the skill.']
2) A new session offers no skill that shares its name with a command of its plugin # features/skill/collisions.feature:34
     Given the user has run "/claude:plugin install demo@fixtures --scope project", which skipped a skill of the plugin
       AssertionError: actual [['cascade','info']], expected [['cascade','info'],['diagnostic','warning']]
2 scenarios (2 failed)
```

Semantic assessment: both target scenarios ran. Every earlier Given passed (publish, plugin files, marketplace add). Each failed only on the planned assertion: the install emitted the cascade alone, with no shadow warning. Scenario 2 failed in its setup Given, as the plan expects. It never reached the listing, where `/skill:demo-clash` would have been listed. The RED evidence classifier (`check tdd-red-evidence`) has no cucumber adapter, so the plan names this cucumber run as the red proof. Both scenarios pass after `eaaadd6`.

**Task 2** (same command, before `d3eda0c`, exit 1, 1 of 7 scenarios failed):

```text
1) The skills folder's copy wins over a declared path's copy of the same skill # features/skill/collisions.feature:112
     Then the session offers these skills:
       + actual - expected
         '/skill:demo-twin',
       +     'Twin in extra.'
       -     'Twin in skills.'
7 scenarios (6 passed, 1 failed)
```

Semantic assessment: the install Given passed (one duplicate warning), and the listing assertion failed for the planned reason: the declared `extra/` copy won. It passes after `d3eda0c`. The duplicate-warning install scenario and the elision pin passed before the fix, as expected. The cut warning line `skill source "twin" in "[redacted path]` is the same whichever copy loses, and the elision rule is unchanged.

The unit cases were committed with their product change in both GREEN commits, because the commit hook runs direct coverage for staged source-test pairs. The cucumber red proofs above cover both product rules.

## Step texts added

- `Given the user has run {string}, which skipped a skill of the plugin` (`features/step_definitions/skill/collisions.steps.ts`). It expands run tokens, runs the command through `runCommandPayloads`, and asserts that the payloads' `[kind, severity]` are exactly `[cascade, info]` then `[diagnostic, warning]`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/skills/discover.ts`: `SkillDiscovery` state, `shadowedByCommandWarning`, `admitSkill`, and `skillsFolderFirst`, all module-private. The module header cites D-CF2-03 and D-CF2-04.
- `test/bridges/skills/discover.test.ts`: `resolvedPlugin` takes optional command paths, plus a `writeCommand` fixture. Three D-CF2-03 cases, a 3-row no-shadow loop, and three D-CF2-04 cases. The trailing-separator MANF-03 case now expects `skillDir: helpDirectory`, because the `skills` folder reaches the directory first.
- `test/architecture/declared-component-path-overlap.test.ts`: one expected `generatedNames` array changed (outside the plan's ownership; see Parent lines).
- `features/skill/collisions.feature`, `features/step_definitions/skill/collisions.steps.ts`: new.

## Decisions Made

- The D-CF2-03 warning uses the wording the research recommended. It names no directory, so the feature states the whole line.
- The shadow check comes before generated-name dedup (unit-pinned: `clash/` shadowed, `demo-clash/` admitted without a duplicate warning).
- `assertSafeName` now runs at the start of `admitSkill` for both the self-dir and subdir paths. For the self-dir path this moves it before the MANF-03 seen check. That is equivalent, because a directory reached before passed the same assertion under the same basename.
- Names compare as exact strings (research A4). `commands/Clash.md` does not shadow `skills/clash`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scenario title must start with an upper-case letter**
- **Found during:** Task 1 (first commit attempt; `check:features` in the hook)
- **Issue:** The planned title "/demo:clash sends the model the command's body" fails the feature gate (`features.md` title rule).
- **Fix:** Renamed it "Prompting /demo:clash sends the model the command's body".
- **Files modified:** `features/skill/collisions.feature`
- **Committed in:** `836fa5e`

**2. [Rule 3 - Blocking] Acceptance greps expected one-line text**
- **Found during:** Task 1 acceptance gate
- **Issue:** The warning literal was split over two string pieces, so the grep printed `0`. The header comment also named `skill-names.ts`, so that grep printed `2`.
- **Fix:** The fixed text now sits in one literal, and the header no longer names the module.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/skills/discover.ts`
- **Committed in:** `55d328a`

**3. [Rule 1 - Bug-class hygiene] Stale code-duplication marker removed**
- **Found during:** Task 1 (`npx fallow dupes` with the markers removed)
- **Issue:** Before the change, with both markers removed, fallow reported clone group `dup:c918ae80` (`commands/discover.ts:314-320` vs `skills/discover.ts:148-153`). After the rewrite it reports no clone. The skills-side marker spanned nothing, and fallow never reports such a marker as stale.
- **Fix:** Removed the skills-side marker, per CONVENTIONS.md (restore a marker only above a line its reviewed group still spans).
- **Files modified:** `extensions/pi-claude-marketplace/bridges/skills/discover.ts`
- **Committed in:** `eaaadd6`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 hygiene). **Impact on plan:** no scope change. The commands-side marker needs a parent decision (below).

## Issues Encountered

- The worktree guard refuses compound shell lines that mix `cd`, redirection, and `git`. Each git step ran as its own command.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-02-13 is mitigated: the skipped skill is named in the install's diagnostic. T-02-14 is mitigated: discovery lists only the resolver's contained `componentPaths.commands`, through `commandUpstreamNames`, which uses `readDirEntriesTolerant` and `isPlainMarkdownFile` (no symlinks, no dot files).

## Parent lines

- **Non-owned test edit (expected value only):** `test/architecture/declared-component-path-overlap.test.ts`, "MANF-03 declared skill subdirs under a shipped skills parent warn not at all": `generatedNames` is now `["ui-theme-designer-design-tokens", "ui-theme-designer-help"]` (`warnings: []` unchanged). `git diff bdf7198..HEAD` on that file shows only this line.
- **FG-13 re-check at the Phase 3 merge:** the shadow check compares only top-level `.md` basenames of `componentPaths.commands`. A command named through an object-map `commands` declaration is not compared. Re-check when Phase 3 lands FG-13.
- **Commands-side duplication marker (Phase 3 / parent):** `bridges/commands/discover.ts:314` carries a `fallow-ignore-next-line code-duplication` marker for a clone group that no longer exists, since this plan reshaped the skills walk. Phase 3 or the parent should delete it after confirming with `npx fallow dupes` on the combined tree. The CONVENTIONS.md marker count (41) drops by one now and by one more when that marker goes.
- **Double command-name read:** `bridges/skills/stage.ts` still calls `commandUpstreamNames` for alias claims, and discovery now reads the same directories. A later plan that owns `stage.ts` could pass discovery's set through. This plan did not edit `stage.ts`.
- **Failure timing:** discovery now lists the commands directories, so a directory-level read error other than ENOENT/ENOTDIR (for example EIO) now fails `discoverGeneratedNames` before the ledger. Before, it failed in the skills staging phase.

## Dubious Choices

1. **Scenario title changed** to "Prompting /demo:clash sends the model the command's body" (the gate rejects a title that starts with `/`).
2. **Out-of-ownership expected-value edit** in `test/architecture/declared-component-path-overlap.test.ts` (planned, DC-26 item 2).
3. **Skills-side clone marker removed.** This leaves the commands-side marker orphaned in a file Phase 3 owns, and it changes the documented marker count.
4. **The shadow check runs before generated-name dedup,** so a shadowed skill frees its generated name for another directory. Not probed upstream.
5. **Exact-string command/skill comparison** (research A4, not probed): no case folding. A command basename such as `foo.bar` is compared as-is, while the skill identity normalizes `.` to `-`.
6. **The `/demo:clash` expected text** is `COMMAND CLASH BODY` alone. This is what Pi's prompt-template expansion sends for a command typed with no arguments, measured in this run. Upstream would send the same body (E2 shows `ARGUMENTS:` only when arguments are typed).
7. **The trailing-separator unit case's expected `skillDir`** changed from `helpDirectory + path.sep` to `helpDirectory`, because the `skills` folder now reaches the directory first. The case still proves that both spellings key the same directory.
8. **No TAP RED evidence for the unit cases** (the hook rejects a commit with failing staged-pair tests). The cucumber runs are the red proofs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SKL-04 is proven for a skill against a command and for two skills.
- 02-07 (phase gate) should run `npm run check` on the combined tree. In particular, `fallow dupes` must run once Phase 2's `stage.ts` edits and this `discover.ts` rewrite meet.

## Self-Check: PASSED

- Files exist: `features/skill/collisions.feature`, `features/step_definitions/skill/collisions.steps.ts`, `extensions/pi-claude-marketplace/bridges/skills/discover.ts`.
- Commits `836fa5e`, `eaaadd6`, `55d328a`, `84e0036`, `d3eda0c` are ancestors of HEAD (`git rev-list --count bdf7198..HEAD` = 5 before this SUMMARY).
- Acceptance greps: `as a command of the plugin; ignoring the skill.` in discover.ts = 1. The whole clash warning in the feature = 1. `bridges/commands|../commands/` in discover.ts = 0. `skill-names.ts` in discover.ts = 1. `which skipped a skill of the plugin` in the steps file = 1. `Twin in skills.` in the feature = 3. `Twin in extra.` appears only in the `extra/twin/SKILL.md` doc strings, never in a listing table.
- Plan verification: `node --test test/bridges/skills/discover.test.ts test/architecture/declared-component-path-overlap.test.ts` (27 pass). `npm run test:coverage:direct -- …/discover.ts` (exit 0). `npx cucumber-js features/skill/collisions.feature` (7/7). `npm run test:integration` (exit 0). `npm run test:unpaired` (exit 0). `npm run check:features` (exit 0). `npx fallow dupes --fail-on-issues` (exit 0). Full `npm run test:cucumber`: 1183/1183.

---
*Phase: 02-skills*
*Completed: 2026-11-01*
