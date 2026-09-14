---
phase: 260907-l4w-fix-issue-155-agents-bridge-frontmatter-
plan: 01
subsystem: bridges/agents
status: complete
tags:
  - frontmatter
  - yaml
  - parser
  - agents-bridge
requirements:
  - "#155"
  - AG-6
  - AG-8
  - AGSK-01
  - D-82-01
  - D-82-02
  - D-82-03

dependency_graph:
  requires:
    - bridges/agents/marker.ts (GENERATED_AGENT_MARKER re-export)
    - bridges/agents/types.ts (RawAgentFrontmatter)
  provides:
    - parseFrontmatter block-scalar and implicit-block input semantics
  affects:
    - bridges/agents/discover.ts (sole production consumer)
    - bridges/agents/convert.ts (reads raw.description and the unknown-key loop)

tech_stack:
  added: []
  patterns:
    - indent-aware line state machine (pending block, awaiting key, fold state)
    - startsWith + slice indent stripping instead of a content-built RegExp

key_files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - tests/bridges/agents/frontmatter.test.ts
    - tests/bridges/agents/discover.test.ts

decisions:
  - "Task 3 resolved by the developer as defer-to-pr: the version bump and the CHANGELOG entry land at PR time, covering both #155 and the follow-up SKFM-01 task. No version file was edited."
  - "Accepted the full eight-form block header on input (/^[>|][+-]?\\d*$/), broader than the four forms pi-subagents recognizes, because source agents are hand-authored real YAML that Claude Code accepts."
  - "Kept the emitter byte-unchanged. Multi-line values become reachable for the first time, and emitYamlScalar's newline collapse (AG-8) is what keeps them from injecting a frontmatter key downstream."
  - "Kept the lenient key charset (split on the first colon) rather than adopting pi-subagents' [\\w-]+ restriction, so unknown-key droppedFields provenance keeps working."
  - "Blank lines are collected into implicit blocks, diverging from pi-subagents, which terminates an implicit block at the first blank line. The trailing trim makes the two agree on every non-pathological input."

metrics:
  duration: 23 min
  completed: 2026-09-07
  tasks: 3
  files: 3

actuals:
  tokens: 6030
  tasks: 3
  commits: 2
  plan_head_before: e048a1dd1ba9fca3e1a54aa1cc4d6ea2c4c5caeb
---

# Quick Task 260907-l4w: Agents Bridge Block-Scalar Frontmatter Summary

Reworked the agents bridge's frontmatter parser into an indent-aware state
machine so a `description: >` block scalar parses to its real prose instead of
the bare block indicator, and no continuation line is lifted into a phantom
top-level key.

## What Changed

### Task 1 — Indent-aware state machine (commit `c82a731b`)

`parseFrontmatter`'s input side was replaced. The delimiter handling, body
normalization and every emitter function are byte-unchanged.

The old parser trimmed each line and treated any `key: value` shape as a
top-level key. A `description: >` line therefore stored the literal `>`, and
each indented continuation line was either dropped or, when it contained a
colon, promoted to a key of its own.

The new dispatcher reads each line in a fixed order:

1. A pending block claims blank and indented lines, so nothing inside a block
   value can be read as a key or a list item.
2. Otherwise the pending block is flushed, and the trimmed line is tested for
   blank, then dash, then indent, then key.

The dash test deliberately precedes the indent test. That ordering is what
keeps a dash beneath a non-empty inline value ignored (D-82-03) instead of
turning it into an implicit block.

New behavior:

- All eight block headers are accepted — `>`, `>-`, `>+`, `>2`, `|`, `|-`,
  `|+`, `|2`. The `>` family folds continuation lines into one paragraph,
  preserving blank-line separators and more-indented lines; the `|` family
  keeps their newlines.
- Only a column-0 line can start a key. An indented line with no key awaiting
  continuation is ignored.
- A key with an empty inline value opens an implicit block whose shape the
  first continuation line decides: a dash line folds under AGSK-01, anything
  else collects a plain multi-line value.
- A block that runs to the closing `---` flushes after the line loop.

`stripCommonIndent` derives its prefix with `slice` and removes it with
`startsWith` + `slice`, so no regex is ever built from plugin file content.

### Task 2 — End-to-end pin through the real consumer (commit `0e9fb6c8`)

One case added to the discover owner suite. It seeds a real agent markdown
file whose `description: >` block carries a colon in a continuation line, then
compares the whole discovery record. The single assertion carries both halves
of the defect: the folded prose reaches `raw.description`, and a leaked
continuation line would fail the whole-object comparison — which is what would
otherwise reach `convert.ts`'s unknown-key loop as bogus `droppedFields`
provenance.

### Task 3 — Version bump and changelog (decision recorded, no edits)

Resolved by the developer before execution as **defer-to-pr**. The version bump
and the CHANGELOG entry land at PR time, covering both #155 and the follow-up
SKFM-01 task. `package.json`, `package-lock.json`, `sonar-project.properties`,
`EXTENSION_VERSION` and `CHANGELOG.md` were not touched. The repository stays
at 0.18.1.

## Coverage

Both owner pairs hold complete direct coverage. No pragma and no exception
entry was added anywhere.

| Pair | Baseline | After |
| --- | --- | --- |
| `bridges/agents/frontmatter.ts` | branches 56/56, functions 9/9, lines 388/388 | branches 102/102, functions 19/19, lines 610/610 |
| `bridges/agents/discover.ts` | not re-measured before the change | branches 14/14, functions 3/3, lines 116/116 |

The frontmatter denominators roughly doubled because the rewrite split one
`applyFrontmatterLine` into a dispatcher plus eight named helpers, and the
suite grew from 7 to 23 `parseFrontmatter` cases. The baseline of 56/56, 9/9,
388/388 was measured on this tree before any edit.

## Verification

| Gate | Result |
| --- | --- |
| `test-coverage-direct.mjs` frontmatter.ts | passed, 102/102, 19/19, 610/610 |
| `test-coverage-direct.mjs` discover.ts | passed, 14/14, 3/3, 116/116 |
| `npm run check` | exit 0 end-to-end |

`npm run check` ran all ten stages with no short-circuit: typecheck, lint,
fallow, format:check, `test:corresponding`, `test:corresponding:negative`,
`test:coverage:direct:negative`, `test` (5215 pass, 0 fail) and
`test:integration` (31 pass, 0 fail).

**No integration failure occurred**, so none needed reproducing on the
pre-change tree. The standing v1.19 debt that `format:check` short-circuits
before the tests did not apply here — the plan's verified fact held.

Constraint checks:

- `git diff` over `bridges/agents/` shows changes only in `frontmatter.ts`, and
  within it only the input-side region. The one emitter name appearing in the
  diff is a module-header comment line.
- The test file diff is 303 insertions and **0 deletions**, so every
  pre-existing `parseFrontmatter` case is byte-unchanged — none was edited,
  retitled or removed. The intercepted-empty-key tripwire still passes, which
  confirms the parser writes values with plain `raw[key] = value` assignment
  and an inherited `Object.prototype` setter still swallows them.
- New and edited comments carry no phase, plan, wave or milestone reference and
  keep the AG-6, AG-8, AGSK-01, D-82-01, D-82-02, D-82-03 and `#155` anchors.

## Deviations from Plan

**1. [CLAUDE.md] Both commit subjects shortened to fit the 72-character limit**

- **Found during:** Task 1 and Task 2 commits
- **Issue:** The plan's suggested subjects run to 79 and 74 characters. The
  project's Conventional Commits rule caps a title at 72.
- **Fix:** `fix(agents): honor YAML block scalars in frontmatter (#155)` (59)
  and `test(agents): pin block scalars through agent discovery (#155)` (61).
  Both keep the type, scope, intent and issue anchor.
- **Files modified:** none — commit metadata only
- **Commits:** `c82a731b`, `0e9fb6c8`

**2. [Measurement correction] An early "pre-existing fallow dupes failure" was a piped-exit-code artifact**

- **Found during:** Task 1 verification
- **Issue:** `npm run fallow 2>&1 | tail -25` prints a `✗ 840 lines (1.2%)
  duplicated across 38 files` summary line. Piping meant the reported exit
  status belonged to `tail`, and the `✗` glyph was read as a gate failure.
- **Fix:** Re-ran unpiped. `npx fallow dupes --fail-on-issues` exits 0 and the
  `npm run fallow` chain exits 0. The glyph is fallow's duplication summary
  marker, not a verdict — `fallow health` prints `✗ 0 above threshold` while
  also exiting 0. Nothing was pre-existing and nothing needed recording as a
  deferred failure.
- **Files modified:** none
- **Note:** The backup-swap experiment run to test the hypothesis restored both
  files by md5 before any commit, so no work was lost.

No other deviations. No auth gates. No Rule 4 architectural decisions arose.

## Known Stubs

None. The changed files carry no TODO, FIXME, placeholder, skipped test,
coverage pragma or `eslint-disable`.

## Threat Flags

None. The plan's threat register was implemented as written:

- **T-155-02 (DoS, mitigated):** both regexes are anchored and free of
  quantified alternation (`/^[>|][+-]?\d*$/`, `/^[ \t]/`), and the indent strip
  uses `startsWith` + `slice` rather than a RegExp compiled from file content,
  so pi-subagents' `escapeRegex` path was deliberately not ported.
- **T-155-03 (Tampering, mitigated):** the emitter is byte-unchanged.
  Multi-line values are reachable for the first time, and the integration case
  `T-d8i-01: provenance stays invisible to pi-subagents' own frontmatter
  parser` still passes.
- **T-155-04 (Information Disclosure, mitigated):** the column-0-keys-only rule
  removes the phantom-key lift. The `provenance:` case asserts the whole `raw`
  object, so a leak fails the gate.
- **T-155-01 (Tampering, accepted):** values are always strings and assignment
  is always plain `raw[key] = value`, as the register requires.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` — FOUND
- `tests/bridges/agents/frontmatter.test.ts` — FOUND
- `tests/bridges/agents/discover.test.ts` — FOUND
- commit `c82a731b` — FOUND
- commit `0e9fb6c8` — FOUND
