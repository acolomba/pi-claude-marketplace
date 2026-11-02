---
phase: 01-harness-and-version-raise
plan: 02
subsystem: testing
tags: [cucumber, harness-rules, decisions, file-ownership]

requires: []
provides:
  - "Component-features ownership table, function directories, reserved names, and parent-owned files rule in the cucumber layout rule"
  - "Profile Pi, project trust, scripted model, model-turn When, stand-in, reset, and CI shard rules in the cucumber world rule"
  - "PROJECT.md Key Decisions rows D-CF1-01..D-CF1-17, the D-24 supersession, and the per-kind Out of Scope bullet"
affects: [harness plans 01-03..01-09, skills, slash-commands, agents, hooks, mcp-servers, workflows]

actuals:
  tokens: 38250    # chars/4 over the added diff lines (152,993 chars); the PROJECT.md table pads each row to about 7,700 chars, and the unpadded text is about 6,500 tokens
  tasks: 3
  commits: 3
plan_head_before: fa95fecf60648e0fadba1d24d2090fb1bd82642f
plan_head_after: 3f737fb9b5a3e301cea43e8ad2e36919159bc5ed

tech-stack:
  added: []
  patterns:
    - "Kind-prefixed parameter types and step texts for parallel component phases (the D-08 verb rule applied to kinds)"
    - "Autonomously settled decision rows name their DUBIOUS-CHOICES entry in the bold label"

key-files:
  created: []
  modified:
    - .agents/skills/cucumber/rules/layout.md
    - .agents/skills/cucumber/rules/world-and-stand-ins.md
    - .planning/PROJECT.md

key-decisions:
  - "D-CF1-03, D-CF1-08, and D-CF1-14..17 cite DC-01, the nearest DUBIOUS-CHOICES entry, because no entry names them; the orchestrator may add a dedicated entry"
  - "The ownership section lists the seed feature file names from plans 01-04..01-08 (agent has two seeds: invocation and project-trust); plan 01-09 reconciles names with the built harness"
  - "The new layout section uses Phase numbers beside kind names because it copies the milestone-scoped ROADMAP section and carries the key-link pattern 'Frozen after Phase 1'"
  - "PROJECT.md rows are padded to the existing column widths to match the table's formatting; mdformat skips .planning/"

patterns-established:
  - "Component-features ownership: one owner per shared harness file; parent-owned lines go into each phase SUMMARY"

requirements-completed: [HAR-08, DEC-01, DEC-02]

coverage:
  - id: D1
    description: "layout.md holds the component-features ownership table, the six function directories with seeds, writers, and step modules, the reserved names, and the parent-owned files rule"
    requirement: HAR-08
    verification:
      - kind: other
        ref: "grep -c 'features/slash-command/' and 'scripted-model/' and 'edge/command-invocation.ts' .agents/skills/cucumber/rules/layout.md (3, 2, 2)"
        status: pass
      - kind: other
        ref: "npm run check:features"
        status: pass
    human_judgment: true
    rationale: "Whether the ownership table is complete and unambiguous for six parallel sessions is a reading judgment; plan 01-09 reconciles it with the built harness"
  - id: D2
    description: "world-and-stand-ins.md describes the profile Pi, trust.json trust, the scripted model, the model-turn When, the stand-ins, the reset, the CI shards, and the backslash-bang note"
    requirement: HAR-08
    verification:
      - kind: other
        ref: "grep -c 'trust.json' / 'agent_settled' / 'D-CF1-17' .agents/skills/cucumber/rules/world-and-stand-ins.md (2, 1, 2)"
        status: pass
      - kind: other
        ref: "SKIP=npm-check pre-commit run --files <both rule files>"
        status: pass
    human_judgment: true
    rationale: "The rules describe a harness that does not exist yet; their accuracy is checked when plan 01-09 reconciles them"
  - id: D3
    description: "PROJECT.md Key Decisions hold D-CF1-01..17 with the research refinements, D-24 is marked superseded, and the Out of Scope bullet states the per-kind rule"
    requirement: DEC-01
    verification:
      - kind: other
        ref: "grep -o 'D-CF1-[0-9][0-9] (component-features' .planning/PROJECT.md | sort -u | wc -l (17); grep -c 'Custom component-path arrays as supplemental' (0); grep -c 'Superseded 2026-10-31 for commands, agents, and workflows by D-CF1-06' (1)"
        status: pass
    human_judgment: true
    rationale: "DEC-01 and DEC-02 rest on flagged assumptions (what 'recorded with IDs' means, which bullet contradicts D-07) that the verifier must classify"

duration: 8min
completed: 2026-11-01
status: complete
---

# Phase 1 Plan 02: Harness Rules and Decision Records Summary

**The cucumber skill now carries the component-features ownership table and the profile Pi and scripted-model rules, and PROJECT.md records D-CF1-01 through D-CF1-17 with the D-24 supersession and the per-kind Out of Scope bullet.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-01T01:51:21Z
- **Completed:** 2026-11-01T01:58:59Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `layout.md` gained a "Component features" section: the six function directories with their seed features, fixture writers, and seed step modules (D-CF1-08); the "Frozen after Phase 1" list, including the frozen invocation cores; the per-phase ownership table with `edge/command-invocation.ts` under Phase 3; the reserved names; the kind prefix for parameter types and steps; the parent-owned files rule; and the cross-kind rule (XK-01, MCP-07, HOOK-08). It also states that a scenario pins a divergence from Claude Code only with a decision ID or a Pi capability gap (the HAR-08 prohibition).
- `world-and-stand-ins.md` gained "Profile Pis and the scripted model": the per-scenario profile Pi (D-CF1-15), `trust.json` trust and the settings-file trap, the separate MCP approval `Given` (D-CF1-07), the file-backed scripted model with no fallback reply (D-CF1-17), the model-turn `When` and its `agent_settled` wait, the registry probe, hook recorder, and MCP stub, the no-dedup rule for the nested `mcp` proxy, the clean-baseline reset, the CI shards (D-CF1-16), and the `\!` note (D-CF1-01).
- `PROJECT.md` Key Decisions gained seventeen D-CF1 rows. Each autonomously settled row names its DUBIOUS-CHOICES entry, and D-CF1-09..12 are recorded as the user's 2026-10-31 decisions from spike 028. The D-24 Outcome now reads "Superseded 2026-10-31 for commands, agents, and workflows by D-CF1-06; skills keep the union", and the Out of Scope bullet states the per-kind rule.

## Task Commits

1. **Task 1: ownership table and reserved names in the layout rule** - `94495c0` (docs)
2. **Task 2: profile Pi, scripted model, and stand-ins in the world rule** - `94ed77e` (docs)
3. **Task 3: D-CF1-01..17 in PROJECT.md and the Out of Scope bullet** - `3f737fb` (docs)

## Files Created/Modified

- `.agents/skills/cucumber/rules/layout.md` - component-features ownership, function directories, reserved names, parent-owned files
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` - profile Pis, trust, the scripted model, the model turn, stand-ins, reset, CI shards
- `.planning/PROJECT.md` - Key Decisions rows D-CF1-01..17, the D-24 Outcome, the per-kind Out of Scope bullet

## Decisions Made

- D-CF1-03, D-CF1-08, and D-CF1-14..17 have no DUBIOUS-CHOICES entry of their own. Their rows cite DC-01 (decisions the parent settled without the user), the nearest entry. DC-01's text names the pre-fan-out items and the directory names, so it covers D-CF1-03 and D-CF1-08 but only loosely covers D-CF1-14..17.
- The research refinements went into the rows they refine: D-CF1-01 carries 0-based indexing, the tokenizer residual (compound-statement and error-recovery rows), the install-time path substitution residual, `${user_config.*}` left literal, and the `${CLAUDE_EFFORT}` mapping (plus DC-15's unknown-level-as-`high`); D-CF1-02 carries the bypass-permissions license and the `shell: powershell` rule; D-CF1-13 carries the hybrid and the plan 01-14 precondition.
- The seed feature names in the layout table come from plans 01-04..01-08. Agents have two seeds (`invocation.feature`, `project-trust.feature`), so the table says "seed features".
- The cross-kind rule names the frozen fixture writers (such as `published-marketplace.ts`) instead of "Phase 1 fixture writers", because the six `<kind>-files.ts` writers pass to their phases and a cross-kind scenario must not use another phase's lib file (ROADMAP wording).

## Deviations from Plan

None. The plan ran as written. The judgment calls are listed under Decisions Made and Dubious Choices.

## Issues Encountered

- The worktree isolation guard refused compound shell commands that named git paths or used `${SKIP:+,$SKIP}`. `SKIP` was empty in this session, so the commands ran as `SKIP=npm-check pre-commit run --files ...`, which is the same command. The plan commit ledger is kept in the scratchpad, not in the git dir. The base is `fa95fecf`.

## Flagged assumptions (from the plan)

- **DEC-01 (unclassified, unresolved):** assumed that "recorded with IDs" means one PROJECT.md Key Decisions row per decision. CONTEXT.md already holds the IDs, and the rows add the refinements. Flagged for the verifier.
- **DEC-02 (unclassified, unresolved):** assumed that "the PROJECT.md bullet that contradicts D-07" is the Out of Scope bullet "Custom component-path arrays as supplemental" (research Q10 and CONTEXT D-CF1-06 name it). Flagged for the verifier.

## Dubious Choices

1. **DC-01 cited for D-CF1-14..17.** No DUBIOUS-CHOICES entry names these four decisions. DC-01 covers the decisions the parent settled without the user, but its text lists only the pre-fan-out items. The orchestrator may want to add an entry for "Phase 1's own decisions" (D-CF1-14..17) and update the four row labels.
2. **Phase numbers in a skill rule.** The new layout section uses "Phase 1" and phase numbers beside kind names. A skill file outlives the milestone, and project policy keeps GSD process names out of comments and test titles. This section is milestone-scoped and copies the ROADMAP, and the plan's key link greps for "Frozen after Phase 1", so the names stay. A later cleanup can drop the section when the milestone closes.
3. **Seed feature names fixed before the harness exists.** The layout table names `invocation.feature`, `listing.feature`, `project-trust.feature`, `tool-use.feature`, `run.feature`, and the seed step modules, taken from the sibling plans. Plan 01-09 must correct them if the built names differ.
4. **Padding of PROJECT.md rows.** The new rows are padded to the table's existing column widths (about 7,700 characters per row) to match the existing rows. That inflates the `actuals.tokens` figure. Unpadded rows would also render.
5. **"Upstream applies T2e and HRe on the Skill tool path" (D-CF1-03 Rationale).** This is inferred from research Q2 and Q4 (`getPromptForCommand` handles plugin skills, and a Skill-tool call can pass `undefined` args). It was not re-checked in the 2.1.316 binary in this run.
6. **HAR-08 prohibition placed in the layout rule.** The rule that a scenario pins a divergence only with a decision ID or a Pi gap went into the layout section, the only planned file where it fits. `features.md`, where feature-file rules live, was not in this plan's file list.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The harness plans (01-03..01-08) can build to the named modules and rules. Plan 01-09 reconciles the rules with the harness as built.
- The parent may add a DUBIOUS-CHOICES entry for D-CF1-14..17 (Dubious Choice 1).

## Self-Check: PASSED

- FOUND: `.agents/skills/cucumber/rules/layout.md`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`, `.planning/PROJECT.md`
- FOUND commits on HEAD: `94495c0`, `94ed77e`, `3f737fb` (`git rev-list --count fa95fecf..HEAD` = 3 before this SUMMARY)
- Acceptance criteria re-run: layout greps 3/2/2, world greps 2/1/2, PROJECT.md label count 17, old bullet 0, D-24 Outcome 1. `npm run check:features` passed. Pre-commit is clean on all three files.

---
*Phase: 01-harness-and-version-raise*
*Completed: 2026-11-01*
