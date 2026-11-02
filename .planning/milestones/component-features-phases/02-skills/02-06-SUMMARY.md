---
phase: 02-skills
plan: 06
subsystem: skills-aliases
tags: [skills, aliases, autocomplete, tui, rpc, cucumber]

requires:
  - phase: 02-skills
    provides: "02-01: the pi-claude-marketplace record (names) on every staged SKILL.md; readSkillRecord"
  - phase: 02-skills
    provides: "02-03: edge/skill-aliases.ts routes every alias token, bare or qualified, through invokeBridgedSkill for interactive and RPC input"
provides:
  - "orchestrators/skill-alias-state.ts: the alias table from the stored upstream names, first claim wins, the legacy elided-alias fallback for unrecorded skills"
  - "features/lib/pi-tui.ts: optional extensions, arguments, readyText, and PiTuiSession.typeText"
  - "features/skill/aliases.feature: SKL-05 over RPC (10 scenarios incl. a 3-row Outline) and in the TUI (1 scenario)"
  - "features/step_definitions/skill/aliases.steps.ts: the one-When TUI alias turn"
affects: [02-07, 03-commands]

actuals:
  tokens: 11437
  tasks: 3
  commits: 4
plan_head_before: 6abbb5abdbf220caf8b787d81bdcdc1e5ee9596a
plan_head_after: 19786130033cd04790672e110817fe2460c528da

tech-stack:
  added: []
  patterns:
    - "A session-time loader reads install-time facts from the staged file's record and falls back to the old derivation only when the record is absent"
    - "A TUI step waits on Pi's own render events: the resource listing for readiness, the completion menu marker, the redrawn input, and the scripted reply"

key-files:
  created:
    - features/skill/aliases.feature
    - features/step_definitions/skill/aliases.steps.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts
    - test/orchestrators/skill-alias-state.test.ts
    - features/lib/pi-tui.ts

key-decisions:
  - "loadQualifiedSkillAliases takes Partial<SkillAliasDependencies> merged over the defaults, so a unit case can run the production readFile with fake state; the edge's call is unchanged."
  - "The profiled TUI's readiness text is `[Extensions]` (Pi's loaded-resource listing), not the first-frame footer `faux-1`: Pi prints the listing only after the extensions' session_start ran and setupAutocompleteProvider installed the alias provider (interactive-mode.js bindCurrentSessionExtensions)."
  - "edge/skill-aliases.ts stays unchanged: every alias scenario passed through 02-03's routing."

patterns-established:
  - "An alias scenario states the whole message the model received, either the skill block or the typed text"

requirements-completed: [SKL-05]

coverage:
  - id: D1
    description: "/demo:review, /demo:fancy, and the bare /fancy each send the review skill's whole block with ARGUMENTS: Ada over RPC (E1, D-CF2-02, D-CF2-05)"
    requirement: SKL-05
    verification:
      - kind: e2e
        ref: "features/skill/aliases.feature#Each name Claude Code gives a skill sends it to the model (3 rows)"
        status: pass
      - kind: unit
        ref: "test/orchestrators/skill-alias-state.test.ts#D-CF2-02: maps each name a loaded skill stored to its generated name"
        status: pass
    human_judgment: false
  - id: D2
    description: "Claim rules: a shared frontmatter name goes to the first skill (bare and qualified); the elided alias is dropped for recorded skills and kept for unrecorded ones; a command keeps its name; an unclaimed name reaches the model as typed; reserved names and earlier claims hold (invariant table)"
    requirement: SKL-05
    verification:
      - kind: e2e
        ref: "features/skill/aliases.feature (6 scenarios: two dupe, demo:tool, demo:demo-tool, clash, nothing)"
        status: pass
      - kind: unit
        ref: "test/orchestrators/skill-alias-state.test.ts (18 cases incl. the 4-row invariant table)"
        status: pass
    human_judgment: false
  - id: D3
    description: "After disable an alias reaches the model as typed; after enable it sends the skill block again (D-CF2-11)"
    requirement: SKL-05
    verification:
      - kind: e2e
        ref: "features/skill/aliases.feature#A disabled plugin's skill alias reaches the model as typed"
        status: pass
      - kind: e2e
        ref: "features/skill/aliases.feature#Enabling the plugin again restores its skill alias"
        status: pass
    human_judgment: false
  - id: D4
    description: "In Pi's real TUI, /demo:fa + Tab completes demo:fancy and sending it with Ada gives the model the review skill's block (D-CF2-05)"
    requirement: SKL-05
    verification:
      - kind: e2e
        ref: "features/skill/aliases.feature#Completing a skill alias in the terminal sends the skill to the model"
        status: pass
      - kind: other
        ref: "npm run test:cucumber -- features/marketplace/background-update.feature (10/10) and node --test test/architecture/pi-tui-notices.test.ts (4/4)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full gate on this worktree"
    verification:
      - kind: other
        ref: "npm run check (static, unpaired, integration, 1219/1219 cucumber scenarios, direct coverage of all pairs): exit 0"
        status: pass
    human_judgment: false

duration: 33min
completed: 2026-11-01
status: complete
---

# Phase 2 Plan 06: Skill aliases from Claude Code's stored names Summary

**The `/plugin:skill` aliases are now exactly the names Claude Code 2.1.316 gives a plugin skill, read back from the record install stored in each staged `SKILL.md` (first claim wins, commands keep their names, the elided alias survives only for unrecorded skills), proven over RPC and by completing `/demo:fa` with Tab in a real Pi TUI driven by the scripted model.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-11-01T11:15:51Z
- **Completed:** 2026-11-01T11:48:22Z
- **Tasks:** 3
- **Files modified:** 5 (2 created)

## Accomplishments

- `loadQualifiedSkillAliases` reads each loaded bridged skill's staged `SKILL.md` (`readFile` dependency, default `node:fs/promises` utf8), parses it, and maps every name of `readSkillRecord(frontmatter)?.names`; without a record it falls back to the old elided alias (DC-25 item 1); a read or parse failure skips the skill. Names are added only when no non-skill command holds them (SK-6) and no earlier skill claimed them (user root, then project root, state order); the old later-root overwrite is gone. Reads run in parallel after the two sequential state reads, so claims stay in loader order.
- `features/lib/pi-tui.ts`: optional `extensions`, `arguments`, `readyText`, and `typeText(text)`; `sendLine` now calls `typeText`. `world.startTuiSession()`, `test/e2e/_rpc.ts`, and `test/architecture/pi-tui-notices.test.ts` are unchanged and pass.
- `features/skill/aliases.feature` (`Feature: Skill aliases`): 11 RPC scenarios (a 3-row Outline plus 8) and 1 TUI scenario, each stating the whole model message.
- `features/step_definitions/skill/aliases.steps.ts`: one `When` that starts the profiled TUI, registers `onRelease(() => tui.stop())` at once, waits on render events only, and records the turn.
- Full `npm run check`: exit 0 (1219/1219 cucumber scenarios, integration, direct coverage of all pairs).

## Task Commits

1. **Task 1: Resolve a frontmatter-name alias over RPC from the stored names (tracer)**
   - `ac34561` test(skills): expect every Claude Code name of a skill to invoke it (RED)
   - `2e318e8` feat(skills): resolve skill aliases from the names stored at install (GREEN)
2. **Task 2: Pin the alias rules** - `b5e4858` test(skills): pin the claim rules and lifecycle of skill aliases
3. **Task 3: Complete and send a skill alias in the real terminal UI** - `1978613` test(skills): complete and send a skill alias in the terminal UI

Tracer gate (Task 1): the `<verify>` chain (both unit files, direct coverage of `skill-alias-state.ts`, the alias feature, `npm run fallow` inside `check:static`) passed after GREEN, and `npm run test:modules` exited 0, before Task 2 started.

## Red proofs

**Task 1** — `npx cucumber-js features/skill/aliases.feature` after `ac34561`, before the loader change: `3 scenarios (1 passed, 2 failed)`.

```text
  2) Each name Claude Code gives a skill sends it to the model # features/skill/aliases.feature:35
           +     '/demo:fancy Ada'
           -     '<skill name="demo-review" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-review/SKILL.md">\n' + ...
  (the /fancy row) -    "/fancy Ada"
                   +    "<skill name=\"demo-review\" ... ARGUMENTS: Ada\n</skill>"
```

Semantic assessment: every Given passed in all three rows; `/demo:review` passed (identity equals the old elided alias), and the `/demo:fancy` and `/fancy` rows failed only on the whole-message assertion, because the old table had no frontmatter-name alias and Pi sent the typed text. After `2e318e8`: 3/3 pass.

**Task 2** — the alias feature (11 RPC scenarios) run against the base loader (`6abbb5a`'s `skill-alias-state.ts`, restored from git into the working tree for the run, then put back): `11 scenarios (5 passed, 6 failed)`. Failed: the `/demo:fancy` and `/fancy` rows, both shared-name scenarios (no `same` alias), `A skill answers to its plugin and directory name` (old table had `demo:tool`, not `demo:demo-tool`), and `A skill no longer answers to the name its plugin prefix was cut from`:

```text
           +     '<skill name="demo-tool" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-tool/SKILL.md">\n' + ...
           -     '/demo:tool Ada'
```

Passed on both loaders, as guards: the `/demo:review` row, the command clash (D-CF2-03; the edge's command check wins first), the unclaimed name, disable, and enable. With the new loader: 11/11. No scenario needed a loader change beyond Task 1.

**Task 3** — negative edit (expected block renamed to `demo-greet`), run, reverted: `11 steps (10 passed, 1 failed)`, `+ '<skill name="demo-review" ...' / - '<skill name="demo-greet" ...'`. Also run against the base loader: `Error: terminal text →  timed out after 10000 ms` (no completion menu for `/demo:fa`, because the old table had no `demo:fancy`).

The RED evidence classifier (`check tdd-red-evidence`) has no cucumber adapter, so it was not run; the cucumber runs above are the plan's named red proofs. Unit cases were written with the GREEN change (the commit hook would reject failing staged-pair tests).

## TUI spike measurements (A6)

Profiled TUI: `dist/bundle/cli.js --offline --no-session --extension <extension> --extension features/lib/scripted-model/extension.ts --provider faux --model faux-1`, `TMPDIR=<home>/tmp`, sandbox `HOME`/`PI_CODING_AGENT_DIR`, plugin installed through the profile Pi.

- (a) **First rendered screen:** the footer only — `<project dir>`, `0.0%/128k (auto)`, and `faux-1`; no `Warning: No models available.`. The header, `[Skills]` (`demo-review, demo-skill`), and `[Extensions]` (`extension.ts, pi-claude-marketplace`) lines arrive in later writes.
- (b) **Alias provider before the first keystroke:** Pi starts the UI before binding extensions and accepts text during startup; `bindCurrentSessionExtensions` runs `session_start` (where `edge/skill-aliases.ts` adds its provider), then `setupAutocompleteProvider()`, then `showLoadedResources()`. So `[Extensions]` appearing proves the provider is installed; `faux-1` does not. **Readiness text used: `[Extensions]`.**
- (c) **After `/demo:fa`:** the menu shows `→ demo:fancy` (only the qualified alias; DC-25 item 4). After Tab the input reads `/demo:fancy` with a trailing space (typing `Ada` next reached the model as `ARGUMENTS: Ada`). Pi renders the turn as `[skill] demo-review (ctrl+o to expand)`, then the reply `Noted.`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts` - stored-name alias table, first claim, legacy fallback.
- `test/orchestrators/skill-alias-state.test.ts` - 18 cases (strong-mock `getCommands`, in-memory state and files, one temp-dir case for the production reader, a 4-row invariant table); 100% direct coverage.
- `features/lib/pi-tui.ts` - optional profile options and `typeText`.
- `features/skill/aliases.feature` - new.
- `features/step_definitions/skill/aliases.steps.ts` - new.

## Decisions Made

See `key-decisions`. Also: the TUI step types the arguments right after Tab (no leading space), relying on Pi's completion trailing space as a user would; the turn's `prompt` records the keystrokes `"/demo:fa\tAda"`; the step asserts the script's last step is a reply and that no call overflowed, as `the user prompts` does.

## Deviations from Plan

### Auto-fixed Issues

None in product code. Smaller departures, each recorded under Dubious Choices:

1. **[Plan detail] `Partial<SkillAliasDependencies>`** instead of a full dependencies object, so the default `readFile` lambda is covered by a hermetic case (100% direct coverage) without a real `state.json` or env mutation.
2. **[Plan detail] The TUI scenario omits `Given the user has started a new pi session`:** the TUI is a new Pi process that loads the installed skill itself; the RPC session was not used by the turn.
3. **[Plan detail] The shared-name behavior is two scenarios** (bare and qualified) instead of one with `/same` only, because the must-haves name both and an Outline needs three rows.
4. **[Plan detail] A `Background:`** holds the profile `Given`, the published marketplace, and its plugin table, which every scenario needs.
5. **Readiness text `[Extensions]`** instead of a footer text, for the ordering reason above.

**Total deviations:** 0 auto-fixed; 5 plan-detail choices. **Impact on plan:** none on scope; `edge/skill-aliases.ts` and every frozen file are unchanged.

## Issues Encountered

- As in 02-03, the commit hook printed `(no files to check)` for `npm run check:commit` and prettier in this worktree; `npm run check:static` ran before each code commit, `npm run test:modules` after Task 1, and the full `npm run check` (which runs `test:cucumber`) after Task 3. A separate full `npm run test:cucumber` was not repeated because `npm run check` already ran all 1219 scenarios.
- Root sandbox: npm scripts and cucumber ran through the session's `nondac-sh`/`setpriv` wrapper.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Threat-register mitigations applied: T-02-16 (non-skill command names reserved; first claim wins; the clash and unclaimed-name scenarios; unit SK-6 case), T-02-18 (`this.onRelease(() => tui.stop())` immediately after start; environment = allowlist plus the run's git keys plus `TMPDIR` inside the sandbox; `PI_OFFLINE=1` from `rpcChildEnvironment`).

## Parent lines

- **CHANGELOG.md** (parent-owned): "Skill aliases now match Claude Code: `/<plugin>:<skill dir>`, `/<plugin>:<frontmatter name>`, and the bare `/<frontmatter name>`. The shortened alias with the plugin prefix cut from the directory name (such as `/acme:foo` for `acme-foo`) is gone; skills installed before this release keep it until you update or reinstall their plugin."
- **docs / PRD SK-6:** aliases now also come from frontmatter `name` and include a bare form; a bare alias equal to a Pi built-in command name is not reserved (DC-25 item 3 residual).
- **Phase 3:** a plugin command whose name equals a skill's frontmatter alias keeps the name; `edge/command-invocation.ts` sees non-alias text unchanged.

## Dubious Choices

1. **`Partial<SkillAliasDependencies>`** (merged over defaults) rather than a full object, to cover the default reader hermetically.
2. **TUI readiness `[Extensions]`**: depends on Pi printing its loaded-resource listing at startup (true in the sandbox, measured on Pi 1.4.0); a future Pi that hides it by default would time the step out, loudly.
3. **The step relies on Pi's completion trailing space** and sends `Ada` right after Tab.
4. **Waiting on the menu marker `→ `** after typing the prefix and on the prefix text in the redrawn input after Tab; a wrong completion is still caught by the whole-message `Then`.
5. **No new RPC session in the TUI scenario** (plan listed one).
6. **The command-clash, unclaimed, disable, and enable scenarios pass on the old loader too**; they pin behavior (guards), not new rules.
7. **Legacy fallback (DC-25 item 1) applies to any staged file without a record**, including a hand-edited one with the key removed; a record with the wrong shape also falls back (readSkillRecord returns undefined).
8. **Bare-alias order across plugins and case sensitivity** were not probed upstream (deferred in CONTEXT); this table uses loader order and exact match.
9. **WINDOWS.md not appended:** no stub, skipped test, or unrun verify.

## TDD Gate Compliance

RED `ac34561` (test) precedes GREEN `2e318e8` (feat). Tasks 2 and 3 added scenarios only (`test`) and needed no further product change; their red evidence is the base-loader runs above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 02-07 (gate) can run `npm run check` on the merged tree; this worktree's run passed.

## Self-Check: PASSED

- Files exist: `features/skill/aliases.feature`, `features/step_definitions/skill/aliases.steps.ts`, and the three modified files.
- Commits `ac34561`, `2e318e8`, `b5e4858`, `1978613` are ancestors of HEAD; `git rev-list --count 6abbb5a..HEAD` = 4 before this SUMMARY.
- Acceptance greps: `readSkillRecord(` in the loader 1; `| /fancy ` 1; `| /demo:fancy ` 1; `/demo:tool Ada` 2 (step and typed-text row); `/demo:nothing Ada` 2; `disable demo@fixtures --scope project` 2; `enable demo@fixtures --scope project` 1; `readyText` in pi-tui.ts 6; `typeText` 2; `currentRun` in the step module 0; `onRelease` 1; `features/support/world.ts` and `test/e2e/_rpc.ts` unchanged since `6abbb5a`.
- `npx cucumber-js features/skill/aliases.feature`: 12/12; `npm run check`: exit 0.

---
*Phase: 02-skills*
*Completed: 2026-11-01*
