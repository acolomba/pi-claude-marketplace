---
phase: 84-emit-an-agent-local-skillpath-field-on-every-generated-agent
plan: 04
subsystem: testing
tags: [pi-subagents, skillPath, subagent-spawn, uat, issue-86]

requires:
  - phase: 84-01
    provides: emitter writes skillPath on skill-referencing generated agents
  - phase: 84-02
    provides: pi-subagents >=0.35.0 optional peer floor
provides:
  - SC-4 live foreground A/B UAT evidence — skillPath is the deciding factor for on-demand skill use
affects: [milestone-completion, issue-86]

tech-stack:
  added: []
  patterns:
    - "Live foreground (async:false) subagent A/B via pi-subagents /run — sidesteps the #526 async confound"

key-files:
  created:
    - .planning/workstreams/issue-86-agent-skill-preloads/phases/84-emit-an-agent-local-skillpath-field-on-every-generated-agent/84-04-SUMMARY.md
  modified: []

key-decisions:
  - "SC-4 verified via the REAL end-to-end path (install through the Phase 84 bridge -> /run foreground spawn), not a minimal hand-staged fixture"
  - "Used /run (foreground, async:false) so pi-subagents #526 (detached async-runner TypeBox regression) cannot confound the result"

patterns-established:
  - "SC-4 A/B: toggle only the emitted skillPath line on the generated agent; everything else held constant"

requirements-completed: [AGSK-06]

coverage:
  - id: D1
    description: "Live foreground spawn of a skill-referencing bridged agent loads and uses the skill on demand; skillPath is the sole toggled variable (SC-4, D-84-03)"
    requirement: "AGSK-06"
    verification:
      - kind: manual_procedural
        ref: "/run pi-claude-marketplace-hello-plugin-hello-agent 'Follow your instructions.' — A/B with vs without skillPath line"
        status: pass
    human_judgment: true
    rationale: "A live LLM subagent spawn is inherently a live-environment observation, not expressible as node:test. Human observed both runs: token present WITH skillPath, sentinel WITHOUT."

duration: n/a (human-verify checkpoint)
completed: 2026-07-20
status: complete
---

# Phase 84 / Plan 04: SC-4 Live Foreground A/B Summary

**skillPath is the deciding factor: a real bridged agent, spawned foreground on pi-subagents 0.35.1, loads and uses its skill only when the emitted `skillPath` line is present — closing issue #86 end-to-end.**

## Performance

- **Type:** checkpoint:human-verify (blocking), no code changes
- **Completed:** 2026-07-20
- **Tasks:** 1/1 (human-verified)
- **Files modified:** 0 (UAT evidence only)

## Accomplishments

- Reproduced the SC-4 acceptance signal through the **real end-to-end path**: installed `hello-plugin` from a local marketplace via the Phase 84 bridge (`/claude:plugin install hello-plugin@hello-marketplace` + `/reload`), which generated the agent `pi-claude-marketplace-hello-plugin-hello-agent` carrying **both** `skills: hello-plugin-hello-world` and `skillPath: ../pi-claude-marketplace/resources/skills`.
- Confirmed the emitted `skillPath` is the single deciding variable for on-demand skill use in a live foreground subagent spawn.

## UAT Evidence (SC-4 A/B)

**Environment:** pi 0.80.10, pi-subagents 0.35.1, provider `openai-codex` / `gpt-5.5`, foreground spawn via `/run` (`async: false`).

**Generated agent (fresh install through the Phase 84 bridge):**
`<scope>/agents/pi-claude-marketplace-hello-plugin-hello-agent.md`
- `skills: hello-plugin-hello-world`
- `skillPath: ../pi-claude-marketplace/resources/skills`

**Run A — WITH `skillPath`:**
```
/run pi-claude-marketplace-hello-plugin-hello-agent Follow your instructions.
-> HELLO_WORLD_FROM_SKILL_ZX9
```
The subagent resolved the bridged `hello-world` skill (via the emitted `skillPath`), read its `SKILL.md`, and emitted the skill's unique token. PASS.

**Run B — WITHOUT `skillPath`:** the `skillPath:` line was deleted from the generated agent file (nothing else changed), then the identical command re-run:
```
/run pi-claude-marketplace-hello-plugin-hello-agent Follow your instructions.
-> NO_SKILL_LOADED
```
Without `skillPath`, the skill did not resolve; the agent printed its no-skill sentinel. PASS.

**Conclusion:** the delta between the two runs is caused solely by the `skillPath` line. SC-4 satisfied (D-84-03). No `typebox/compile` / #526 confound was encountered (foreground `async: false`).

## Relationship to the automated criteria

- **SC-1** (unit): emitter writes `skillPath` iff `skills:` non-empty; skill-less agents byte-identical. Green (Plan 84-01).
- **SC-2** (automated integration): the emitted `skillPath` resolves the staged skill through pi-subagents' real `resolveSkillsWithFallback` and stays out of the global catalog. Green (Plan 84-03).
- **SC-4** (this plan): the live foreground A/B proves the whole pipeline works at spawn time.

Together, SC-1/SC-2/SC-4 close issue #86 end-to-end.

## Decisions Made

- Verified through the real bridge install rather than a hand-staged fixture, so the test exercises the actual Phase 84 emission path.
- Foreground `/run` (async:false) chosen deliberately per the plan to avoid the pi-subagents #526 detached-async-runner confound.

## Deviations from Plan

None - the plan's A/B recipe was executed as written (via the real install path), and the token-vs-sentinel delta matched the expected result.

## Issues Encountered

- Initial `/run hello-plugin-hello-agent ...` failed with `Unknown agent`: the bridge prefixes generated agents with the extension name, so the correct `name:` is `pi-claude-marketplace-hello-plugin-hello-agent`. Resolved by using the generated `name:` frontmatter value.

## Next Phase Readiness

- Phase 84 plans 01-04 all complete; SC-1..SC-4 satisfied. Ready for phase verification and milestone completion.

---
*Phase: 84-emit-an-agent-local-skillpath-field-on-every-generated-agent*
*Completed: 2026-07-20*
