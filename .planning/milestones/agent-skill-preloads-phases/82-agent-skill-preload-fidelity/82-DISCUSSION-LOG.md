# Phase 82: Agent Skill Preload Fidelity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 82-Agent Skill Preload Fidelity
**Areas discussed:** Block-list parsing strictness, Advisory note placement & format, Body token detection scope, Dropped-Skill warning wording (+ freeform: real-YAML-parser evaluation, inheritSkills design)

---

## Block-list parsing strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Any key | Dash items fold into any key's CSV value; unknown list keys land cleanly in droppedFields | ✓ |
| Known list keys only | Fold only under tools/skills/disallowedTools | |

**User's choice:** Any key.
**Notes:** User asked whether a real YAML parser should replace the lenient
line-based parser. Resolved empirically: scanned all 27 agent files in
`claude-plugins-official` with js-yaml (YAML 1.1) and yaml (YAML 1.2).
`plugins/pr-review-toolkit/agents/silent-failure-hunter.md` (Anthropic's own)
has a 1442-char unquoted description containing `Context: Daisy` — both real
parsers reject the whole frontmatter; Claude Code and our parser accept it.
Zero mixed forms, zero dash-form block lists, zero type-coercion hazards
found. Lenient parser confirmed; YAML-parser option declined.

| Option | Description | Selected |
|--------|-------------|----------|
| You decide | Claude picks mixed-form behavior, documents + pins with test | ✓ |
| Inline value wins | Lock now: dash items skipped | |
| Append dash items | Lock now: dash items appended | |

**User's choice:** You decide (inclination noted: inline value wins).

---

## Advisory note placement & format

| Option | Description | Selected |
|--------|-------------|----------|
| Top, after provenance | Legend before original prose — child LLM reads mapping first | ✓ |
| End of body | Appended after original prose | |

| Option | Description | Selected |
|--------|-------------|----------|
| Labeled blockquote | Converter-voice blockquote | |
| Heading + section | Markdown heading section | ✓ |
| Compact paragraph | Single-paragraph note | |

**User's choice:** Heading + section; user explicitly dropped
converter-branding from the heading and named it a skill legend.
Heading locked: `## Pi coding agent skill legend` (user offered "legenda",
chose the standard English "legend" from the follow-up).

---

## Body token detection scope

| Option | Description | Selected |
|--------|-------------|----------|
| Known same-plugin skills | Only `<this-plugin>:<discovered-skill>` tokens | ✓ |
| Also same-plugin unknown | Flag unknown same-plugin tokens too | |
| Also cross-plugin tokens | Flag any plugin-qualified shape | |

| Option | Description | Selected |
|--------|-------------|----------|
| Whole body | Scan including fenced code blocks | ✓ |
| Prose only | Skip fenced code blocks | |

**User's choice:** Known same-plugin skills; whole-body scan.

---

## Dropped-Skill warning wording

Warning scope (Skill-only) was not asked: forced by the byte-identical
success criterion (warnings for all dropped tools would change output for
agents the phase must not touch).

**User's questioning reshaped this area.** The user asked why generated
agents disable skill inheritance at all. Investigation of pi-subagents
0.28.0 and pi-coding-agent source established: declared `skills:` are
full-content injected (eager preload); `inheritSkills: false` spawns the
child `--no-skills`; Pi's inherited catalog is lazy (name+description list,
read on demand) — i.e. a faithful analog of Claude's Skill tool, whose
catalog is environment-dependent in Claude Code too. The recorded
out-of-scope rationale ("no Pi-native dynamic invocation surface exists")
was found overstated.

**Outcome:** map source `Skill` tool → `inheritSkills: true` as NEW
requirement AGSK-05 in a NEW Phase 83, same milestone (user: "fold it into
phase 83 ... just stay in the same milestone"). Phase 82 keeps
`inheritSkills: false` universally and locks the forward-compatible
accurate warning wording (D-82-09) so Phase 83 is additive.

---

## Claude's Discretion

- Mixed-form parser behavior (documented + test-pinned).
- Final polish of warning string and legend line phrasing.

## Deferred Ideas

- Phase 83 / AGSK-05: `Skill` tool → `inheritSkills: true` mapping with
  warning-wording branch, legend "available on demand" state,
  byte-identical carve-out extension, duplication pinning test.
