---
phase: quick-260720-d8i
plan: 01
subsystem: bridges/agents
tags: [agents, frontmatter, provenance, security]
status: complete
dependency-graph:
  requires: []
  provides:
    - provenance frontmatter mapping on emitGeneratedAgentFile output (generatedBy + sourcePlugin/sourceAgent/sourcePath/originalModel/droppedFields/droppedTools/warnings, with dropped*/warnings as YAML lists)
    - sanitizeProvenanceValue newline-normalization helper (renamed from sanitizeProvenance)
    - GENERATED_AGENT_MARKER_LEGACY back-compat marker; isOwnedAgentFile accepts either the current or legacy marker
  affects:
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - extensions/pi-claude-marketplace/bridges/agents/marker.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - extensions/pi-claude-marketplace/bridges/agents/index.ts
tech-stack:
  added: []
  patterns:
    - Provenance folded under a single `provenance` frontmatter mapping instead of a body HTML comment, relying on pi-subagents' line-based parser storing-and-ignoring the unknown key and skipping every indented member line.
    - Dual ownership marker (current `generatedBy: pi-claude-marketplace` line + legacy body-comment phrase) so already-installed agents stay recognized with no migration.
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - extensions/pi-claude-marketplace/bridges/agents/marker.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - extensions/pi-claude-marketplace/bridges/agents/index.ts
    - tests/architecture/markers-snapshot.test.ts
    - tests/bridges/agents/frontmatter.test.ts
    - tests/bridges/agents/convert.test.ts
    - tests/bridges/agents/convert-byte-identity.test.ts
    - tests/bridges/agents/marker.test.ts
    - tests/bridges/agents/stage.test.ts
    - tests/bridges/integration.test.ts
    - tests/bridges/integration-foreign-content.test.ts
    - CHANGELOG.md
decisions:
  - Combined the emitter/source changes and the test regeneration into a single commit per iteration, because this repo's pre-commit hook runs `npm run lint` and `npm run typecheck` on the whole project (not scoped to staged files), so a source-only commit that leaves tests referencing a renamed/removed export fails those whole-project hooks.
  - Four design refinements from the coordinator arrived across the task (flat frontmatter keys; fold into a block-list dropping `generator`; rename the container key to `provenance`; then final shape as a YAML mapping with a `generatedBy` key and real YAML lists). Because history must not be rewritten (repo rule) and `--amend` is forbidden (task constraints), each landed as its own atomic commit.
  - `generatedBy: pi-claude-marketplace` replaced the bare marker sentence, which removed the old literal from the file. Rather than weaken detection, a legacy marker constant was added and `isOwnedAgentFile` now accepts either marker, preserving recognition of pre-0.10 body-comment files.
metrics:
  duration: ~120m
  completed: 2026-07-20
---

# Quick Task 260720-d8i: Move agent provenance into a `provenance` frontmatter mapping

Moved generated-agent provenance (source plugin, source agent, source path,
original model, dropped fields/tools, warnings) out of a body HTML comment and
into a single `provenance` frontmatter mapping, so it no longer enters the
bridged subagent's system prompt (pi-subagents sets `systemPrompt: body`
verbatim, with no comment stripping).

## Commits

1. `b3bcc28e` — `fix(AG-5,AG-8): move generated-agent provenance to frontmatter
   keys`. First cut: provenance moved from the body HTML comment to eight flat
   frontmatter keys, plus the `sanitizeProvenance` -> `sanitizeProvenanceValue`
   rename and doc updates across `frontmatter.ts`, `marker.ts`, `types.ts`,
   `convert.ts`, `index.ts`.
2. `331586f7` — `refactor(AG-5,AG-8): fold agent provenance under
   piSubagentMetadata`. Replaced the eight flat keys with a single YAML
   block-list and dropped the top-level `generator` key.
3. `30cc87ed` — `refactor(AG-5,AG-8): rename agent provenance key to
   provenance`. Renamed the container key to `provenance` for code<->artifact
   consistency with `GeneratedProvenanceFields` / `sanitizeProvenanceValue`.
4. `a5f9d926` — `refactor(AG-5,AG-8): provenance as YAML mapping with
   generatedBy`. Final shape: `provenance` becomes a YAML mapping; the marker
   sentence becomes a `generatedBy: pi-claude-marketplace` key; `droppedFields`
   / `droppedTools` / `warnings` render as real YAML lists (`[]` when empty, a
   `    - item` block when non-empty). Added `GENERATED_AGENT_MARKER_LEGACY`
   and made `isOwnedAgentFile` accept either marker.

The final on-disk state is described below.

## What Changed

`emitGeneratedAgentFile` in `frontmatter.ts` appends a single `provenance`
mapping to the frontmatter `lines` array immediately after `inheritSkills`, and
no longer builds a `<!-- ... -->` HTML comment. `GENERATED_AGENT_MARKER` is now
`"generatedBy: pi-claude-marketplace"` — exactly the content of the emitted
`generatedBy` line, which the emitter builds as `  ${GENERATED_AGENT_MARKER}`,
keeping a single source of truth. `isOwnedAgentFile` matches a file that
contains **either** `GENERATED_AGENT_MARKER` (current format) or
`GENERATED_AGENT_MARKER_LEGACY` (`"generated by pi-claude-marketplace"`, the
pre-0.10 body-comment phrase), so already-installed old-format agents stay
recognized with no migration.

List fields render through a `pushProvenanceList` helper: an empty list emits
`  <key>: []`; a non-empty list emits `  <key>:` followed by one
`    - <item>` line per newline-normalized item. The old `(none)` sentinel and
`formatOptionalProvenanceList` are gone.

The parser-safety helper `sanitizeProvenanceValue` (renamed earlier from
`sanitizeProvenance`) collapses `\r?\n` runs to a single space, applied to
`sourcePath`, `originalModel`, and each list item — so a multi-line value can't
be misread as a new frontmatter key by pi-subagents' line-based parser.

Doc comments across `frontmatter.ts`, `marker.ts`, `types.ts`, and `convert.ts`
describe the mapping placement, the dual-marker contract, and the
newline-normalization contract in place of the removed HTML-comment framing.

## Why it is invisible to the child LLM

`provenance:` parses as an unknown key with an empty value (stored-and-ignored
by both pi-subagents and our own parser). Its member keys and list items all
carry leading whitespace, so pi-subagents' `^([\w-]+):` top-level key regex
skips them entirely. The body (which becomes the child system prompt) excludes
every provenance byte.

## Byte layout

Old layout (removed): a `<!-- generated by pi-claude-marketplace ... -->` HTML
comment in the body.

New layout:
```
---
<core frontmatter fields>
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: ...
  originalModel: ...        # only when defined
  droppedFields: []         # or a "    - item" block when non-empty
  droppedTools: []
  warnings: []
---

<optional skill legend>
<body>
```

The body still starts at the same relative offset (one blank line after the
closing `---`, or after the skill legend when present) — only the provenance's
home moved from body to frontmatter.

## Tests

- `tests/architecture/markers-snapshot.test.ts`: asserts both marker constants
  byte-for-byte (`generatedBy: pi-claude-marketplace` and the legacy phrase).
- `tests/bridges/agents/marker.test.ts`: added a back-compat case proving
  `isOwnedAgentFile` still recognizes a pre-0.10 file carrying only the legacy
  body-comment phrase, plus a snapshot of the legacy constant.
- `tests/bridges/agents/frontmatter.test.ts`: regenerated the full-file byte-pin
  constants to the mapping layout; the marker test asserts the whole output
  includes `GENERATED_AGENT_MARKER`; a positive test asserts the parsed body
  excludes provenance.
- `tests/bridges/agents/convert.test.ts`: regenerated byte-pins; retargeted the
  cross-plugin-token injection test to the new shape.
- `tests/bridges/agents/convert-byte-identity.test.ts`: regenerated all
  `EXPECTED_N` constants, covering empty lists (`[]`) and non-empty block lists
  (phantom-skill warning, `droppedFields: color/hooks`, etc.).
- `tests/bridges/agents/stage.test.ts`, `tests/bridges/integration.test.ts`,
  `tests/bridges/integration-foreign-content.test.ts`: swapped hardcoded marker
  strings for the `GENERATED_AGENT_MARKER` constant and retitled body-centric
  assertions.

`npm run check` (typecheck + eslint + prettier format:check + node:test unit
[2982 passed, 2 skipped, 0 failed] + integration [17 passed, 0 failed]) is
green.

## Deviations from Plan

**1. Whole-project pre-commit hooks force combined code+test commits.** The
pre-commit hook runs `npm run lint` / `npm run typecheck` on the whole project,
not scoped to staged files, so each iteration's source and test changes had to
land in one commit.

**2. Four atomic refinement commits instead of one.** The coordinator's design
refinements arrived after each prior commit; repo rules forbid history rewrite
and `--amend`, so each landed as its own commit (b3bcc28e, 331586f7, 30cc87ed,
a5f9d926).

**3. Executor stalled on the final iteration; orchestrator completed it.** The
`a5f9d926` iteration made all source and test edits but its agent run hit the
600s no-progress watchdog before committing (it stalled during the check). The
orchestrator reviewed the uncommitted edits, fixed one `import-x/order` lint
error in `stage.test.ts` via `eslint --fix`, confirmed `npm run check` green,
and made the commit.

## Auth Gates

None.

## Known Stubs

None.

## Threat Flags

None — the plan's `<threat_model>` (T-d8i-01, T-d8i-02, T-d8i-03) covers the
only security-relevant surface (provenance rendering and the ownership-marker
check). The dual-marker change keeps both ownership gates (basename prefix +
marker substring) intact.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts`: FOUND
- `extensions/pi-claude-marketplace/bridges/agents/marker.ts`: FOUND
- `extensions/pi-claude-marketplace/bridges/agents/index.ts`: FOUND
- `tests/architecture/markers-snapshot.test.ts`: FOUND
- `tests/bridges/agents/marker.test.ts`: FOUND
- `tests/bridges/agents/convert-byte-identity.test.ts`: FOUND
- `CHANGELOG.md`: FOUND
- Commit `b3bcc28e`: FOUND in `git log --oneline`
- Commit `331586f7`: FOUND in `git log --oneline`
- Commit `30cc87ed`: FOUND in `git log --oneline`
- Commit `a5f9d926`: FOUND in `git log --oneline`
