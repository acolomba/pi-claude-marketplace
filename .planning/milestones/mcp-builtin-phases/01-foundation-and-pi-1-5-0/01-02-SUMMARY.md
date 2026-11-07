---
phase: 01-foundation-and-pi-1-5-0
plan: "02"
subsystem: planning, testing
tags: [decisions, cucumber, mcp-builtin, dual-profile]

requires: []
provides:
  - "PROJECT.md Key Decisions rows D-MB-01..D-MB-13 (01..07 Locked, 08..13 Pending)"
  - "APL-D1 amended by D-MB-03"
  - "Current Milestone text consistent with D-MB-04 and D-MB-13; Pi API constraint >=1.5.0 (dev ^1.5.0)"
  - "Dual-profile cucumber contract: profiles adapter/builtin, world parameter mcpImplementation, four implementation tags, frozen MCP implementation step texts, restart and stand-in semantics, CI profile axis"
  - "mcp-builtin ownership section in the cucumber layout rules (frozen files, phase table, reserved names, parent-owned files)"
affects: [01-07, 01-09, 01-10, 01-13, 01-14, phase-2, phase-3, phase-4, phase-5]

actuals:
  tokens: 12900
  tasks: 2
  commits: 2
plan_head_before: d8bba1bf9dc76655ad930f6c20177121a61319c3
plan_head_after: 87228054b6ad338b96dbc7ca7c84a5a274477bb8

tech-stack:
  added: []
  patterns:
    - "Decision rows for parity defaults settled without the user carry 'settled autonomously, pending user review' and outcome -- Pending"
    - "MCP scenarios carry exactly one of @mcp, @adapter-only, @builtin-only, @own-implementation"

key-files:
  created: []
  modified:
    - .planning/PROJECT.md
    - .agents/skills/cucumber/SKILL.md
    - .agents/skills/cucumber/rules/features.md
    - .agents/skills/cucumber/rules/layout.md
    - .agents/skills/cucumber/rules/steps.md
    - .agents/skills/cucumber/rules/world-and-stand-ins.md

key-decisions:
  - "D-MB-01..D-MB-07 recorded as user decisions (Locked); D-MB-08..D-MB-13 recorded as Phase 1 parity defaults pending user review (Pending), D-MB-11 in its amended form (no clientName, no clientRegistration)"
  - "The durable function-directory facts of the old Component features section are kept under a new '## Function directories' heading instead of being deleted"

patterns-established:
  - "Implementation tags may sit on Feature, Rule, Scenario, or Examples; source tags stay on Examples only"
  - "Restart steps replace the scenario's profile Pi; one profile Pi per scenario otherwise"

requirements-completed: [MDEC-01, DUAL-01]

coverage:
  - id: D1
    description: "13 D-MB decision rows in PROJECT.md Key Decisions, each ID exactly once"
    requirement: MDEC-01
    verification:
      - kind: other
        ref: "for n in 01..13: grep -c '^| \\*\\*D-MB-$n ' .planning/PROJECT.md -> 1 each; grep -cE '^\\| \\*\\*D-MB-(0[1-9]|1[0-3]) ' -> 13"
        status: pass
    human_judgment: true
    rationale: "The rows record user decisions and autonomous parity defaults; the user must review D-MB-08..D-MB-13 (Pending) before they are final."
  - id: D2
    description: "APL-D1 names D-MB-03; Current Milestone says before substitution, adapter/builtin profiles, '-' kept; Pi API constraint >=1.5.0"
    requirement: MDEC-01
    verification:
      - kind: other
        ref: "grep -c 'D-MB-03' -> 4; grep -c 'before plugin-variable substitution' -> 3; grep -c 'Claude-shaped form, after' -> 0; grep -c 'pinned to `>=1.5.0` (dev `^1.5.0`)' -> 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dual-profile cucumber contract in the cucumber skill (tags, profiles, step texts, restarts, stand-in, CI axis, ownership)"
    requirement: DUAL-01
    verification:
      - kind: other
        ref: "grep checks of the plan's verify and acceptance_criteria; SKIP=npm-check,trufflehog pre-commit run --files .agents/skills/cucumber/SKILL.md .agents/skills/cucumber/rules/*.md; npm run check:static"
        status: pass
    human_judgment: true
    rationale: "Plans 01-07, 01-09, 01-10, and 01-13 implement this contract; 01-13 reconciles any wording the implementation changes, so the final contract text is judged after the harness lands."

duration: 15min
completed: 2026-11-04
status: complete
---

# Phase 1 Plan 02: MCP Built-in Decisions and Dual-Profile Cucumber Contract Summary

**Thirteen D-MB decision rows (seven user decisions locked, six parity defaults pending review) in PROJECT.md, plus the dual-profile cucumber contract (adapter and builtin profiles, four implementation tags, nine frozen MCP step texts, restart and stand-in rules, CI profile axis, and the mcp-builtin file ownership) in the cucumber skill.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-11-04T03:59:47Z
- **Completed:** 2026-11-04T04:14:22Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- PROJECT.md Key Decisions gains D-MB-01..D-MB-13 in the table's form. D-MB-01..07 use REQUIREMENTS.md's wording (user decisions, `-- Locked`). D-MB-08..13 use 01-CONTEXT.md's wording with the amendments, cite their P1-DC entries, and are `-- Pending`. D-MB-07 carries the four rendering rules Phase 3 follows. D-MB-11 is the amended form: no `oauth.clientName`, no `clientRegistration`, and the client name is a Pi-gap divergence.
- The APL-D1 row ends with an amendment sentence naming D-MB-03.
- The Current Milestone section names all 13 IDs beside the decision list, records servers before plugin-variable substitution (D-MB-04), names the `adapter` and `builtin` profiles, and says the registered built-in name keeps `-` and only tool names fold (D-MB-13). The Pi API constraint reads `>=1.5.0` (dev `^1.5.0`). A new `_Last updated` line heads the footer.
- `features.md`: source tags stay on Examples blocks; the four implementation tags can sit on any block; a new "MCP implementations" section defines an MCP scenario, the tags, what each profile runs (with the tag expressions), the `@mcp` adapter-name ban, the ID rule for `@adapter-only`/`@builtin-only`, the pair rule, and what `check:features` enforces.
- `world-and-stand-ins.md`: the shared Pi follows the profile (onboarding seed under adapter); every RPC Pi is checked against its launch configuration with the extension's own detection rule (TUI Pis are not); the nine frozen step texts verbatim; restart semantics; the `@own-implementation` seed removal; the stand-in; the builtin-profile stub-exit reset check; `test:cucumber` vs `test:cucumber:profile`; the three-leg CI profile axis.
- `steps.md`: the `the user has run <command>, which did not fail` setup variant.
- `layout.md`: "## Component features" replaced by "## Function directories" (durable layout facts kept) and "## MCP built-in" (frozen list, phase ownership table copied from ROADMAP, shared-by-function rule, state-rows rule, reserved names with their owners, parent-owned files). "## Parallel work" and "## Boundaries" kept.
- `SKILL.md`: `npm run test:cucumber` runs both profiles, and a review requires every scenario to pass under both.

## Task Commits

1. **Task 1: Record D-MB-01..D-MB-13 and correct the milestone text in PROJECT.md** - `2130d18` (docs)
2. **Task 2: Write the dual-profile cucumber contract and the mcp-builtin ownership table** - `8722805` (docs)

Tracer gate (Task 1): interactive run, `end-of-phase`, automated-only verify; re-ran both greps (13 and 1) and continued to Task 2.

## Files Created/Modified

- `.planning/PROJECT.md` - D-MB rows, APL-D1 amendment, Current Milestone text, Pi API constraint, footer
- `.agents/skills/cucumber/SKILL.md` - both profiles in the review run
- `.agents/skills/cucumber/rules/features.md` - tag placement rules and the "MCP implementations" section
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` - profile harness contract, step texts, restarts, stand-in, reset, CI
- `.agents/skills/cucumber/rules/steps.md` - the `which did not fail` setup variant
- `.agents/skills/cucumber/rules/layout.md` - function directories and the mcp-builtin ownership section

## Decisions Made

- Row format follows the existing user-decision (D-LOC-01) and autonomous (D-CF*) rows: `| **ID (milestone, provenance): title**. text | rationale | outcome |`.
- See Dubious Choices for each judgment call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale statements in the cucumber rules that the new contract contradicts**
- **Found during:** Task 2
- **Issue:** `features.md` said "`cucumber.json` excludes no tag, so every row runs", false once the profiles filter on implementation tags. `world-and-stand-ins.md` said "One scenario starts at most one profile Pi", which the restart steps contradict, and the MCP listing-wait bullet named only the adapter-specific step.
- **Fix:** "excludes no source tag, so every row of every source kind runs"; the one-profile-Pi rule now excepts the restart steps; the listing bullet names the neutral wait for `@mcp` scenarios and keeps the adapter step for `@adapter-only`.
- **Files modified:** `.agents/skills/cucumber/rules/features.md`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`
- **Verification:** pre-commit (mdformat, markdownlint) and `npm run check:static` pass
- **Committed in:** `8722805`

**2. [Rule 2 - Missing] Durable layout facts kept when the Component features section was replaced**
- **Found during:** Task 2
- **Issue:** The plan replaces the whole section; it also held durable facts (function directory names, fixture writers, shared step modules per kind, the MCP stub-marker caveat) that no other rule file states.
- **Fix:** Kept them under a new "## Function directories" heading, without the phase-history sentences and the "Seed features" column and directory counts.
- **Files modified:** `.agents/skills/cucumber/rules/layout.md`
- **Verification:** `grep -c '^## Component features'` prints 0; `grep -c '^## MCP built-in'` prints 1
- **Committed in:** `8722805`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing content)
**Impact on plan:** Both keep the skill consistent with the new contract. No scope creep.

## Issues Encountered

- `.planning/` is excluded from mdformat and markdownlint in `.pre-commit-config.yaml`, so the padded Key Decisions table is not reformatted (the plan expected mdformat to touch it). The new rows are unpadded, like the rows of the last several milestones.
- The worktree sandbox refuses compound git and `${SKIP:+,$SKIP}` commands, so pre-commit and the commits ran with `SKIP=npm-check,trufflehog` and `SKIP=trufflehog` spelled out (the session exports `SKIP=trufflehog`).

## Verification

- Task 1: 13 rows; each of D-MB-01..13 exactly once; `D-MB-03` on 4 lines; `before plugin-variable substitution` 3; `Claude-shaped form, after` 0; Pi API line 1.
- Task 2: restart/MCP-implementation/registered-servers texts 4 lines in `world-and-stand-ins.md`; `@own-implementation` 3 in features.md and 1 in world-and-stand-ins.md; `^## Component features` 0; `^## MCP built-in` 1; `which did not fail` 1; `test:cucumber:profile` 2; each of the nine step texts present verbatim.
- pre-commit clean on all six files; `npm run check:static` passed before each commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 01-07, 01-09, 01-10, and 01-13 implement the contract verbatim; 01-13 reconciles any wording the implementation changes.
- Parent line for Phase 6 / user review: D-MB-08..D-MB-13 are `-- Pending` until the user reviews them.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- **P1-02-DC-01: D-MB-08..13 provenance and outcome.** Chose the label "(mcp-builtin, Phase 1, settled autonomously, pending user review, DUBIOUS-CHOICES P1-DC-NN)" and outcome `-- Pending`, with D-MB-11 citing both P1-DC-06 and P1-DC-12 and written in its amended form. Alternatives: `-- Locked` like the component-features autonomous rows, or recording D-MB-11 in its original form with an amendment note. Why: the plan says pending and "as amended". Severity: Low.
- **P1-02-DC-02: Rationale text written for the D-MB rows.** REQUIREMENTS.md gives no rationale for D-MB-01..07, so I wrote short rationales from PROJECT.md's decision 4, the milestone goal, the Core Value, and the requirement IDs (for example D-MB-06: "A switch is not a plugin action, so it does not make a later plugin action stop for consent"). Alternatives: leave the rationale cell as "User decision". Why: every other row explains itself. A reviewer may want different wording. Severity: Low.
- **P1-02-DC-03: Kept the durable part of "Component features" under "## Function directories".** The plan said replace the whole section. Alternatives: delete it as the plan says. Why: the per-kind module facts and the stub-marker caveat appear nowhere else. Severity: Low.
- **P1-02-DC-04: Added a step-text rule to the MCP built-in section.** "A step that a phase adds names its topic in its text, so two phases never define the same step text (D-08)" is not in ROADMAP's File ownership; it carries the component-features kind rule over to this milestone. Alternatives: copy ROADMAP only. Why: four parallel phases adding steps can collide on text. Severity: Low.
- **P1-02-DC-05: Contract details beyond the plan's list.** The world rules also name `mcpImplementationLaunch(profile)` (from plan 01-10), the builtin-profile stub-exit reset check (CONTEXT "Isolation"), that the stand-in registers at `session_start` and loads last (RESEARCH), that the settings-off check reads both `{agent dir}/settings.json` and `{project dir}/.pi/settings.json` (plan 01-07), and the rule to pass paths only to `test:cucumber:profile` (RESEARCH Pitfall 6). Alternatives: leave them to 01-13's reconciliation. Why: child phases code against this text and these facts are already decided. Severity: Low.
- **P1-02-DC-06: Reserved names split by owner.** I marked `implementation-profiles.feature` and the four `mcp-implementation`/stand-in names as frozen, `verdict-markers.feature` as passing to Phase 3, and `agent-grants.feature` and `agent-grants.steps.ts` as passing to Phase 4, reading ROADMAP's ownership table and plan 01-14's frozen list. Alternatives: list them as reserved with no owner. Severity: Low.
- **P1-02-DC-07: The "which did not fail" step under steps.md names no ID.** It is a harness variant, not a licensed divergence. Severity: Low.

## Self-Check: PASSED

- FOUND: .planning/PROJECT.md, .agents/skills/cucumber/SKILL.md, .agents/skills/cucumber/rules/{features,layout,steps,world-and-stand-ins}.md
- FOUND: 2130d18 (ancestor of HEAD), 8722805 (ancestor of HEAD)
