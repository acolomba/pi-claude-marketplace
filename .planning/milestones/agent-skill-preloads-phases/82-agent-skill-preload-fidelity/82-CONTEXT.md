# Phase 82: Agent Skill Preload Fidelity - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the agents-bridge conversion pipeline so that (AGSK-01) the documented
YAML block-list form for `skills:`/`tools:` parses with list values intact,
(AGSK-02) plugin-qualified skill names (`<plugin>:<skill>`) map like their
bare forms while cross-plugin qualifiers warn-and-drop, (AGSK-03) the
dropped `Skill` tool gets an explanatory provenance warning, and (AGSK-04)
generated agents whose body references `<plugin>:<source-skill>` tokens
carry a converter-authored skill legend. Every agent the fix does not apply
to produces byte-identical output to today.

**Not in this phase:** mapping the source `Skill` tool to
`inheritSkills: true` — that is Phase 83 (AGSK-05), same milestone.

</domain>

<decisions>
## Implementation Decisions

### Frontmatter parsing (block lists)
- **D-82-01:** Dash-list folding applies to ANY frontmatter key: a key with
  an empty value followed by `- item` continuation lines folds the items
  into that key's CSV value. Unsupported list-valued keys then land in
  `droppedFields` as one clean key name (no bogus `- token` fragments).
- **D-82-02:** Keep the lenient line-based parser; a real YAML parser is
  rejected. Empirical basis: `claude-plugins-official` ships
  `plugins/pr-review-toolkit/agents/silent-failure-hunter.md` whose
  1442-char unquoted description (`... <example>\nContext: Daisy ...`)
  fails BOTH js-yaml (1.1) and yaml (1.2); Claude Code accepts it; our
  parser accepts it (AG-6 contract). Also: YAML 1.1 coerces
  `thinking: off` to boolean false. Official marketplace scan (27 agents):
  0 mixed forms, 0 dash block lists, 0 coercion hazards.
- **D-82-03:** Mixed form (inline value + dash items under one key —
  invalid YAML, zero occurrences in the wild): Claude's discretion.
  Inclination: inline value wins, dash items ignored. Whatever is chosen
  must be documented in the parser comment and pinned by a test.

### Skill legend (body advisory note)
- **D-82-04:** Placement: top of the generated body, immediately after the
  provenance HTML comment, before the original agent prose.
- **D-82-05:** Format: markdown heading + section. Heading exactly
  `## Pi coding agent skill legend`. Accepted shape:

  ```markdown
  ## Pi coding agent skill legend

  These instructions reference Claude skills by their original
  names. In this Pi session:

  - `spec-tree:review-changes` → skill `spec-tree-review-changes`
    (preloaded in your context)
  - `spec-tree:other-skill` — not available in this session
  ```

- **D-82-06:** Detection scope: only `<this-plugin>:<skill>` tokens where
  the skill is actually discovered in the plugin. Annotation is
  "(preloaded in your context)" when the skill is in the emitted `skills:`
  list, "— not available in this session" otherwise. Cross-plugin and
  unknown-skill tokens get NO legend entry (unverifiable, false-positive
  prone).
- **D-82-07:** Detection scans the whole body including fenced code blocks
  (legend is aggregated at top; no inline rewriting, so code-block matches
  are safe and useful; avoids fence-parsing edge cases).

### Skill-drop provenance warning
- **D-82-08:** The new warning fires ONLY when the `Skill` tool is dropped.
  Other dropped tools keep today's silent `droppedTools` behavior — a
  warning for every dropped tool would change output bytes for agents this
  phase must leave byte-identical.
- **D-82-09:** Warning wording (forward-compatible with Phase 83; the
  statement stays true for non-Skill agents after 83 lands):
  `dropped tool "Skill" -- generated agents run with skills discovery
  disabled (inheritSkills: false); only the skills listed in skills: are
  preloaded into the child's context`. Minor final polish is Claude's
  discretion; the two required elements are (a) why the child cannot load
  skills dynamically and (b) the `skills:` list is the child's entire
  skill context.

### Carried forward from milestone kickoff (STATE.md)
- Legend lives in the generated agent body (pi-subagents passes the body
  verbatim as the child's system prompt); never in frontmatter or skill md.
- Generated frontmatter keeps emitting CSV `skills:` (pi-subagents 0.28.x
  compatibility floor).
- Cross-plugin qualified `skills:` entries warn-and-drop, naming the token.
- Legend emission is reference-gated: no body tokens → byte-identical
  output.

### Claude's Discretion
- Mixed-form parser behavior (D-82-03).
- Final polish of warning string (D-82-09) and legend line phrasing beyond
  the accepted shape (D-82-05).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/workstreams/issue-86-agent-skill-preloads/REQUIREMENTS.md` — AGSK-01..05 definitions and out-of-scope table
- `.planning/workstreams/issue-86-agent-skill-preloads/ROADMAP.md` — Phase 82/83 success criteria
- GitHub issue #86 — canonical reproduction (source agent `tools: Bash, Read, Skill` + block-list `skills:` with `spec-tree:review-changes`)

### Implementation surface
- `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` — `parseFrontmatter` (line-based parser to extend with dash-folding), `emitGeneratedAgentFile` (single byte-assembly seam; legend insertion point), AG-6/AG-8 contracts
- `extensions/pi-claude-marketplace/bridges/agents/convert.ts` — `mapSkills` (qualifier handling), `mapTools` (Skill warning site), `splitCsv` (CSV + inline-array; dash-folded values flow through here), `SUPPORTED_SOURCE_FIELDS`
- `extensions/pi-claude-marketplace/domain/name.ts` — `generatedSkillName` (plugin-prefix elision; the mapping bare and qualified forms must agree with)

### External behavior evidence (verified 2026-07-19, versions may drift)
- `~/.pi/agent/npm/node_modules/pi-subagents/src/runs/shared/pi-args.ts:132-134` — `inheritSkills: false` → child spawned `--no-skills`
- `~/.pi/agent/npm/node_modules/pi-subagents/src/agents/skills.ts:579-585` — `buildSkillInjection`: declared `skills:` are FULL-CONTENT injected into the child system prompt
- `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/skills.js` (`formatSkillsForPrompt`) — Pi catalog skills are lazy: name+description+path listing, read on demand

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `splitCsv` in convert.ts: already normalizes CSV and inline-array forms; dash-folded values should be folded into a CSV string upstream so this function needs no change.
- `generatedSkillName` in domain/name.ts: handles `plugin-` prefix elision; qualified-name mapping reduces to stripping the `<plugin>:` qualifier then delegating here.
- `emitGeneratedAgentFile` in frontmatter.ts: the single seam for generated-file assembly — legend insertion belongs here (between provenance comment and body) to keep byte-layout decisions in one module.
- Warnings/droppedTools plumbing in `convertAgent` → provenance: already threads through; AGSK-03 only appends a warning string at the right site.

### Established Patterns
- User-contract tests assert exact equality (MODEL_MAP/TOOL_MAP); wording changes are test-visible — pin the new warning and legend strings.
- node:test under tests/; `npm run check` must stay green (NFR-6).
- Comment policy (`.claude/rules/typescript-comments.md`): anchor with AGSK-NN / D-82-NN / #86, never GSD phase references.

### Integration Points
- `parseFrontmatter` (input side): dash-folding extension.
- `mapSkills`: qualifier stripping for same-plugin, warn-and-drop for cross-plugin.
- `mapTools`: Skill-specific warning.
- `convertAgent` step 7→8 (body → emit): legend detection needs the discovered skill data (`knownSkills` + emitted skills list + pluginName) — all already parameters of `convertAgent`.

</code_context>

<specifics>
## Specific Ideas

- Issue #86 canonical fixture: source `tools: Bash, Read, Skill` +
  block-list `skills:` containing `spec-tree:review-changes` from plugin
  `spec-tree` → generated `tools: bash,read`, `skills:
  spec-tree-review-changes`, `droppedTools: Skill` + warning, clean
  `droppedFields`.
- Legend shape locked per D-82-05 accepted preview.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 83 (AGSK-05, same milestone):** map source `Skill` tool →
  `inheritSkills: true` (unless disallowed via `disallowedTools`). Pi's
  lazy skill catalog + read-on-demand is a faithful analog of Claude's
  Skill tool (catalog is environment-dependent in Claude Code too).
  Interactions identified: AGSK-03 warning wording branches for
  Skill-declaring agents; legend gains an "available on demand as
  `<pi-name>`" state; byte-identical carve-out extends to Skill-declaring
  agents; duplication edge (skill both preloaded and in catalog) needs a
  pinning test. The REQUIREMENTS.md out-of-scope rationale ("no Pi-native
  dynamic invocation surface exists") was found to be overstated and the
  row is removed as part of registering AGSK-05.

</deferred>

---

*Phase: 82-Agent Skill Preload Fidelity*
*Context gathered: 2026-07-19*
