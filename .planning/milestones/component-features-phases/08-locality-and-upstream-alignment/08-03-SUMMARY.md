---
phase: 08-locality-and-upstream-alignment
plan: 03
subsystem: skills
tags: [skills, hooks, model-read, retroactive]
status: complete
retroactive: true

requires:
  - phase: 02-skills
    provides: "the model-read skill fill (a Pi-gap stand-in for the Skill tool)"
  - phase: 05-hooks
    provides: "PostToolUse output replacement"
provides:
  - "a fill that never touches text a hook wrote"
affects: [02-skills, 05-hooks]

plan_head_before: bdd541c86e497c3965a8a09f708b1af9f2f7d8a7
plan_head_after: 227d603df7509c1fe0b646b2d61cd681d9a47e18

key-files:
  modified:
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
    - extensions/pi-claude-marketplace/edge/skill-read.ts
    - features/skill/model-reads.feature

key-decisions:
  - "W6: fill only unchanged text (user decision)"
---

# Plan 08-03 Summary: Model-read skill fill only for the skill's own text

## Commits

- 9789ef5 test(skills): pin a read hook on a skill file the model reads
  (before the milestone first closed; it pinned the old behavior)
- a7fb423 fix(skills): fill a model-read skill only while it is the skill's
  text
- 227d603 docs(planning): mark the model-read fill warning resolved
- ea9b4ea docs(planning): log the model-read fill choices

## What changed

The fill re-runs Pi's read tool over the staged file with the call's offset
and limit. It fills only when that returns exactly the read text, notices
included. Any other text, such as a PostToolUse hook's replacement, reaches
the model as written. This matches Claude Code 2.1.316, which never fills
text a hook wrote.

## Test evidence

`npm run check` exit 0, cucumber 1535/1535 (seed 50578). Red proof: with the
old sources the changed scenario got `Tail 7 at effort low, arguments [].`
(DC-43).

## Deviations and open points

- One extra in-memory read per skill-file read.
- The re-run uses the resolved absolute path, so Pi's one notice that holds
  a path (a single line over 50 KB) never matches; such a result passes
  through unfilled.
- A staged file that changes between Pi's read and the fill is not filled.
- The fill-on-read itself is still a Pi-gap stand-in for the Skill tool.
