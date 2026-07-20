# Phase 84: Agent skillPath resolution (end-to-end skill availability) - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Emit an agent-local `skillPath: ../pi-claude-marketplace/resources/skills` on every
generated agent that has a non-empty `skills:` list, so pi-subagents'
`resolveSkillsWithFallback` resolves the agent's `skills:` names for the spawned
subagent — closing issue #86 end-to-end. Phases 82/83/83.1 made the *conversion*
correct (emitted `skills:`, `inheritSkills`, body legend), but the emitted
references never *resolved*: bridged skills install under
`<scope>/pi-claude-marketplace/resources/skills/`, off pi-subagents' filesystem
scan roots. `skillPath` (PR #470, shipped pi-subagents 0.35.0) points the resolver
at that dir relative to the agent file. Also raise the pi-subagents peer floor and
correct the body legend for 0.35.x lazy delivery.

**In scope:** `skillPath` emission on skill-referencing agents; collapse the body
skill legend to a single "available on demand" state; bump the pi-subagents peer
floor; add requirement AGSK-06; update the byte-identity fixture corpus.

**Out of scope:** changing the emitted `skills:` form (stays CSV, 0.28.x compat);
rewriting skill tokens in body prose; mapping cross-plugin qualified refs to
installed plugins (all carried over from prior phases).

</domain>

<decisions>
## Implementation Decisions

### Legend accuracy (re-amends AGSK-04)
- **D-84-01:** Collapse the body skill legend to a **single state** — every
  referenced skill annotates as `(available on demand)`. Drop the
  `(preloaded in your context)` state and the `preloaded` branch at
  `frontmatter.ts:335` (`entry.preloaded ? "preloaded in your context" : "available on demand"`).
  Rationale: pi-subagents 0.35.x delivers skills **lazily** — `buildSkillInjection`
  emits `<available_skills>` with name/description/`<location>` and "read on
  demand", even for emitted `skills:`. Nothing is eagerly preloaded, so
  "preloaded in your context" overclaims. This re-amends AGSK-04 from its
  two-state form to a single-state legend.
- **D-84-02:** Collapsing strictly improves accuracy and introduces no new
  mislabeling — the non-preloaded branch already said `(available on demand)`;
  only the this-plugin emitted entries change wording. Planner should still
  confirm dropped cross-plugin / unknown references are not newly mislabeled as
  available (they were already `(available on demand)` under the old
  `preloaded=false` branch, so behavior is unchanged there).

### Peer dependency floor
- **D-84-03:** Pin the pi-subagents peer floor to **`>=0.35.0`** (where
  agent-local `skillPath` shipped, PR #470) — matches success criterion 3.
  Planning MUST confirm pi-subagents #526 (0.35.1 async-runner peer resolution)
  does not affect the real subagent spawn/resolution path; if it does, revisit
  the floor. Live end-to-end verification was done on 0.35.1, but skillPath
  itself exists from 0.35.0.

### skillPath emission (from the locked goal)
- **D-84-04:** Emit `skillPath: ../pi-claude-marketplace/resources/skills` when
  the generated agent's `skills:` list is non-empty; agents with no skills emit
  **no** `skillPath` and stay byte-identical to their Phase 83.1 output. Fixed
  relative-path constant. It resolves to
  `<scope>/pi-claude-marketplace/resources/skills` in both user and project
  scope because the agent file lives at `<scope>/agents/<name>.md`. Surface:
  `bridges/agents/frontmatter.ts`, alongside the existing conditional emission of
  `skills`, `systemPromptMode`, `inheritProjectContext`, `inheritSkills`.
- **D-84-05:** Update the byte-identity fixture corpus: skill-referencing agents
  now carry the new `skillPath` line **and** the collapsed annotation;
  skill-less agents must remain byte-identical.

### Claude's Discretion
- **AGSK-06 requirement text:** author to mirror the four ROADMAP success criteria
  (agent-local skillPath resolution); add to REQUIREMENTS.md during planning.
- **Exact refactor** of the legend entry type / how the `preloaded` field is
  removed is the planner's call, provided the emitted annotation is uniformly
  `(available on demand)` and the reference-gated emission stays byte-identical
  for agents with no `<plugin>:<source-skill>` tokens.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase design & evidence
- `.planning/workstreams/issue-86-agent-skill-preloads/phases/84-emit-an-agent-local-skillpath-field-on-every-generated-agent/84-NOTES.md` — the gap analysis, the `skillPath` fix, three-way verification (deterministic resolver A/B + live spawn A/B), and caveats (lazy delivery, floor, AGSK-06). PRIMARY reference.
- `.planning/workstreams/issue-86-agent-skill-preloads/ROADMAP.md` §Phase 84 — goal + 4 success criteria + the AGSK-06 note.
- `.planning/workstreams/issue-86-agent-skill-preloads/REQUIREMENTS.md` — AGSK-01..05 (esp. the AGSK-04 amended form being re-amended by D-84-01); AGSK-06 to add.

### Implementation surface
- `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` — emits `skills`, `inheritSkills`, `systemPromptMode`, `inheritProjectContext`; add `skillPath` here; the legend annotation to collapse is at ~line 335.
- `extensions/pi-claude-marketplace/persistence/locations.ts` — `skillsTargetDir`, confirming the `<scope>/pi-claude-marketplace/resources/skills/` install location the relative path targets.
- `extensions/pi-claude-marketplace/orchestrators/discover.ts` — `skillPaths` / `resources_discover` (the pointer-only surface that does NOT reach pi-subagents' scan roots — the reason `skillPath` is required).
- `package.json` — pi-subagents peer floor to bump to `>=0.35.0`.

### External (pi-subagents upstream)
- pi-subagents PR #470 — agent-local `skillPath` field (shipped 0.35.0).
- pi-subagents #183 — lazy skill delivery (`buildSkillInjection` no longer inlines full bodies; XML `<available_skills>` with `<location>`).
- pi-subagents #526 — 0.35.1 async-runner peer resolution (verify irrelevance to our spawn path before finalizing the floor).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The frontmatter emitter in `bridges/agents/frontmatter.ts` already emits optional
  fields conditionally — `skillPath` follows the identical conditional-emit pattern,
  gated on a non-empty `skills` list.
- The skill legend renderer (Phase 82 `1d638c22` "render skill legend in
  emitGeneratedAgentFile"; Phase 83.1 `3f1e78d4` "unify legend non-preloaded state")
  — its annotation ternary is the collapse target.

### Established Patterns
- Conditional frontmatter emission gated on field presence (`skills`,
  `inheritSkills`) — `skillPath` mirrors it.
- CSV `skills:` emission retained for pi-subagents 0.28.x compatibility — unchanged
  by this phase.
- Byte-identity test corpus for generated agents — the enforcement mechanism that
  D-84-05 must update (new `skillPath` line + collapsed annotation for
  skill-referencing agents; no change for skill-less agents).

### Integration Points
- Generated agent frontmatter -> consumed by pi-subagents `resolveSkillsWithFallback`,
  which resolves `skills:` against `skillPath` with base = `dirname(agent.filePath)`.
- Install location `<scope>/pi-claude-marketplace/resources/skills/` (locations.ts)
  is the resolution target of the emitted relative path.

</code_context>

<specifics>
## Specific Ideas

- Success criterion 4 reproduces the verified A/B from 84-NOTES §Verification: with
  `skillPath` the live subagent read `SKILL.md` and emitted its unique token; with
  `skillPath` removed, it printed `NO_SKILL_LOADED`. That live spawn on
  pi-subagents 0.35.1 is the acceptance signal for end-to-end resolution.

</specifics>

<deferred>
## Deferred Ideas

- Merge `main` into `features/issue-86-agent-skill-preloads` before shipping — the
  branch predates main's fetch-plugin / git-source / url-source work. Release
  hygiene, not Phase 84 scope; tracked outside discuss.

None other — discussion stayed within phase scope.

</deferred>

---

*Phase: 84-emit-an-agent-local-skillpath-field-on-every-generated-agent*
*Context gathered: 2026-07-19*
