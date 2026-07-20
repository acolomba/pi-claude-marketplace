# Phase 84 Notes — Agent skillPath resolution

Context captured 2026-07-19 from the investigation that motivated this phase.
Consumed by `/gsd-discuss-phase 84` / `/gsd-plan-phase 84`.

## The gap (why #86 isn't closed end-to-end)

Phases 82/83/83.1 fixed the **conversion**: generated agents now correctly emit
`skills: <generated-name>`, `inheritSkills`, and the body legend. But the emitted
`skills:` reference is never **resolved** for the spawned subagent:

- The skills bridge installs bridged skills to
  `<scope>/pi-claude-marketplace/resources/skills/<generated-name>/SKILL.md`
  (`persistence/locations.ts` → `skillsTargetDir`) and surfaces them to Pi core
  via `resources_discover` (`orchestrators/discover.ts` → `skillPaths`).
- pi-subagents resolves an agent's `skills:` only against its **own** filesystem
  search roots (`<cwd>/.pi/skills`, `<cwd>/.agents/skills`, `<agentDir>/skills`,
  `~/.agents/skills`, npm-package `pi.skills`, settings `skills`/`packages`).
  It never consults Pi core's `resources_discover` registry, and it never scans
  `resources/skills/`.
- Net: `resolveSkillsWithFallback(['<gen-name>'], …)` returns the skill as
  `missing`; the injection is empty; the subagent runs without the skill.

Contrast with agents, which DO work: bridged agents are written to
`<scope>/agents/` — a directory pi-subagents scans directly — which is why the
subagent is discoverable at all. Skills never got the same shared-location
treatment; they stayed pointer-only via `resources_discover`.

## The fix

Emit an agent-local `skillPath` on every generated agent that has a non-empty
`skills:` list, pointing at the marketplace skills dir relative to the agent file:

```yaml
skillPath: ../pi-claude-marketplace/resources/skills
```

pi-subagents' agent-local `skillPath` (PR #470, shipped in **0.35.0**) resolves
the agent's `skills:` names from that dir, relative to `dirname(agent.filePath)`,
invocation-private (never entering the parent/global catalog). The bridged agent
lives at `<scope>/agents/<name>.md`, so `../pi-claude-marketplace/resources/skills`
resolves to `<scope>/pi-claude-marketplace/resources/skills` in both user and
project scope.

Why this over the alternatives:
- No copy / no symlink (symlinks need admin/dev-mode on Windows — out).
- No `<scope>/skills/` shared-dir pollution; no NFR-10 containment change (the
  bridge already owns both the agent frontmatter and `resources/skills/`).
- Upstream did NOT adopt a "consume `resources_discover` registration" path; no
  issue tracks it. `skillPath` is the purpose-built mechanism.

Implementation surface: `bridges/agents/frontmatter.ts` (emit `skillPath` when
`skills` is non-empty — it already emits `skills`, `systemPromptMode`,
`inheritProjectContext`, `inheritSkills`). The relative path is a fixed constant.

## Verification (done this session, pi-subagents 0.35.1)

1. **Deterministic (0.25.0, your global at the time):** `resolveSkills` against a
   real bridge install of the skill → `missing`, empty injection.
2. **Deterministic (0.35.1 resolver + real install):** without `skillPath` →
   `missing`; with `skillPath: ../pi-claude-marketplace/resources/skills` (base =
   agent-file dir) → resolved; injection lists the skill with its `<location>`.
3. **Live spawn (0.35.1):** A/B on the same agent/skill — with `skillPath` the
   subagent read the SKILL.md and emitted its unique token; with `skillPath`
   removed, it printed `NO_SKILL_LOADED`.

## Caveats / open questions for planning

- **Lazy delivery (#183 landed in 0.35.x):** `buildSkillInjection` no longer
  inlines full skill bodies — it emits `<available_skills>` with
  name/description/`<location>` and "use the read tool to load". So the subagent
  gets the skill *available on demand*, not eagerly preloaded. Claude Code's
  eager `skills:` full-content preload is no longer reproducible via pi-subagents
  regardless. Revisit AGSK-04's "(preloaded in your context)" legend wording — it
  overclaims for the current model; may need to unify on "(available on demand)".
- **Floor bump:** peer floor `>=0.35.0` (skillPath does not exist before). Milestone
  currently pins 0.28.x; global dev install was 0.25.0. Watch pi-subagents #526
  (0.35.1 async-runner peer resolution) before finalizing the exact floor.
- **New requirement:** add `AGSK-06` (agent-local skillPath resolution) to
  REQUIREMENTS.md with acceptance mirroring the success criteria.
- **Byte-identity corpus:** update fixtures so skill-referencing agents include
  `skillPath`; skill-less agents must stay byte-identical.
