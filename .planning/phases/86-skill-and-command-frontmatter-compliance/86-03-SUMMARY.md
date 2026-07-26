---
phase: 86-skill-and-command-frontmatter-compliance
plan: 03
subsystem: bridges
tags: [frontmatter, skills, when_to_use, description, yaml, block-scalar, degrade]

# Dependency graph
requires:
  - phase: 86-01
    provides: "frontmatter-degrade helpers (firstBodyParagraph, foldWhenToUse, truncate1536, setDescriptionScalar) + parseFrontmatter re-export"
  - phase: 86-02
    provides: "two read-only parse gates in skills/stage.ts; the gate-1 RETURN branch (byte-identical passthrough) the augment arm hangs on"
provides:
  - "Gate-1 RETURN augment arm in skills/stage.ts: absent/empty description filled from first body paragraph (SKILL-02/D-86-06), when_to_use folded in (WTU-01/A1), combined text hard-cut at 1,536 (WTU-02/D-86-05/A2), applied via setDescriptionScalar (block-scalar-safe)"
  - "setDescriptionScalar now INSERTS a description key when the source has none (description-less fill), in addition to full-node-span replacement"
  - "SKILL-03 name verification in rewrite-frontmatter.ts: full name-node-span replacement (folded/block scalars) + re-parse assertion that the written name equals the generated name"
affects:
  - "86-04 (commands neutralize — sibling staging seam)"
  - "86-05 (orchestrated reconcile row — consumes degrade signal, unaffected by augment)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compute the description value from the PARSED frontmatter/body, then surgically set a single node span (never re-emit the block) — extends the Plan 01 pattern to the fill/fold/truncate augment arm"
    - "Re-parse-to-verify backstop: a name/description rewrite is validated against Pi's own parseFrontmatter output, never a blind line regex (SKILL-03)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/skills/stage.ts
    - extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts
    - extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts
    - tests/bridges/skills/stage.test.ts
    - tests/bridges/skills/rewrite-frontmatter.test.ts

key-decisions:
  - "The augment arm runs only on the gate-1 RETURN (well-formed) branch, after rewriteFrontmatterName; the synthesize (unparseable) arm already emits a name + placeholder description and skips it"
  - "NREG-01 guard: a present, in-cap description with no when_to_use is left byte-identical (setDescriptionScalar is NOT called), preserving the ~99% happy path"
  - "A description-less skill with no prose body (empty first-paragraph candidate) falls back to a fixed non-empty placeholder ('No description provided.') so Pi does not drop it (skill:null on empty description)"
  - "setDescriptionScalar extended to INSERT a description key when absent (the description-less source has no line to replace) rather than returning unchanged"
  - "SKILL-03 corruption is prevented by full name-node-span replacement AND a re-parse equality assertion; a residual mismatch throws loudly as a self-defect (PARSE-02 family)"

patterns-established:
  - "Parsed-value-in, single-node-span-out augment: read description/when_to_use/body from parseFrontmatter, compute the effective value, write exactly one YAML node"
  - "Re-parse verification of a surgical frontmatter rewrite as a self-defect backstop"

requirements-completed: [SKILL-02, SKILL-03, WTU-01, WTU-02]

coverage:
  - id: D1
    description: "A description-less well-formed skill stages a first-body-paragraph description (skipping heading) and stays model-invocable (no disable-model-invocation)"
    requirement: "SKILL-02"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/stage.test.ts#SKILL-02 description-less skill stages a first-body-paragraph description and stays model-invocable"
        status: pass
    human_judgment: false
  - id: D2
    description: "A description-less skill with no prose body still stages a non-empty description (Pi loads it, does not drop as skill:null)"
    requirement: "SKILL-02"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/stage.test.ts#SKILL-02 empty probe: a description-less skill with no prose body still stages a non-empty description"
        status: pass
    human_judgment: false
  - id: D3
    description: "when_to_use is folded into the description and the combined text is hard-cut at exactly 1,536 UTF-16 code units (no ellipsis)"
    requirement: "WTU-01"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/stage.test.ts#WTU-01 / WTU-02 when_to_use is folded into the description and hard-cut at 1,536"
        status: pass
    human_judgment: false
  - id: D4
    description: "A >1024 combined description still re-parses to a non-empty description (Pi loads it) — not secretly truncated to Pi's 1,024 warning threshold (D-86-05)"
    requirement: "WTU-02"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/stage.test.ts#WTU-02 / D-86-05 a >1024 combined description still parses to a non-empty description (Pi loads it)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A >- block-scalar source description folded with when_to_use is replaced as a full node span; sibling keys stay byte-identical; gate 2 re-parses"
    requirement: "WTU-01"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/stage.test.ts#SKILL-03 / WTU-01 a `>-` block-scalar description is replaced as a full node span, siblings byte-identical"
        status: pass
    human_judgment: false
  - id: D6
    description: "A folded multi-line source name: scalar is rewritten to exactly the generated name (no orphaned continuation lines, no `<gen> a b` corruption); siblings preserved"
    requirement: "SKILL-03"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/rewrite-frontmatter.test.ts#SKILL-03 folded multi-line source name is rewritten to the generated name (no orphaned continuation lines)"
        status: pass
    human_judgment: false
  - id: D7
    description: "An absent source name: is inserted as the generated name; the re-parsed staged name equals the generated name"
    requirement: "SKILL-03"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/rewrite-frontmatter.test.ts#SKILL-03 absent source name is inserted as the generated name"
        status: pass
    human_judgment: false
  - id: D8
    description: "A valid skill with a present description and no when_to_use is still staged byte-for-byte identical (augment arm leaves it untouched)"
    requirement: "NREG-01"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/stage.test.ts#NREG-01 valid skill is staged byte-for-byte identical to a name-rewrite + var-substitution of the source (gates mutate nothing)"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-07-26
status: complete
---

# Phase 86 Plan 03: Skill description augment + SKILL-03 name verification Summary

**The gate-1 RETURN arm now fills a description-less skill from its first body paragraph, folds `when_to_use` in and hard-cuts the combined text at 1,536 — all through the block-scalar-safe `setDescriptionScalar` — and the name rewrite is verified against Pi's own parser so a folded source `name:` can never silently produce a wrong-named skill.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-26
- **Completed:** 2026-07-26
- **Tasks:** 2
- **Files modified:** 5 (5 modified, 0 created)

## Accomplishments
- On the well-formed (gate-1 RETURN) branch, `skills/stage.ts` now augments the `description` Pi reads: an absent/empty `description` is filled from the first body paragraph (`firstBodyParagraph`, skipping headings/code fences per D-86-06), a non-empty `when_to_use` is folded in after a single `\n` (WTU-01/A1), and the combined text is hard-cut at 1,536 UTF-16 code units with no ellipsis (WTU-02/D-86-05/A2). The value is written through `setDescriptionScalar`, so a `>-`/`|` block-scalar source `description` collapses into one safe double-quoted scalar with every sibling key left byte-identical.
- `setDescriptionScalar` gained an INSERT arm: a description-less source (no `description:` line to replace) gets the scalar inserted as the last frontmatter line. An empty first-paragraph candidate on a bodyless skill falls back to a fixed non-empty placeholder so Pi does not drop the skill (`skill: null` on empty description).
- `rewrite-frontmatter.ts` now replaces the FULL `name` node span (folded/block scalars included) and re-parses the result with Pi's own `parseFrontmatter`, asserting the written `name` equals the generated name — a folded or absent source `name:` can no longer corrupt the generated name, and a residual mismatch throws loudly as our own defect.
- NREG-01 preserved: a valid skill with a present, in-cap `description` and no `when_to_use` is left byte-for-byte identical (the augment arm short-circuits before `setDescriptionScalar`), proven by the unchanged byte-equality regression.

## Task Commits

Each task was committed atomically:

1. **Task 1: Augment arm — first-paragraph fill, when_to_use fold, 1,536 truncation** - `2c75676d` (feat)
2. **Task 2: SKILL-03 — verify the written name equals the generated name** - `a81e7def` (feat)

_TDD note: each task's tests were written and confirmed failing before the implementation, then confirmed passing. Because the whole-project `tsc`/`eslint .` pre-commit hooks reject a repo that is not lint-clean, each task's test + implementation landed in one atomic commit rather than separate RED/GREEN commits._

## Files Created/Modified
- `extensions/pi-claude-marketplace/bridges/skills/stage.ts` - gate-1 RETURN augment arm (`augmentSkillDescription`) + captured parse result; empty-body placeholder constant
- `extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts` - `setDescriptionScalar` now inserts a `description:` key when absent (doc comment updated)
- `extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts` - full name-node-span replacement + re-parse name-equals-generated backstop
- `tests/bridges/skills/stage.test.ts` - 5 augment-arm cases (description-less, empty-body, when_to_use fold + 1537→1536, >1024 loads, block-scalar+when_to_use node span)
- `tests/bridges/skills/rewrite-frontmatter.test.ts` - folded multi-line `name:` and absent-`name:` cases

## Decisions Made
None beyond the locked decisions (D-86-05/D-86-06, A1/A2) the plan fixed. Two implementation choices within discretion: (1) the empty-first-paragraph fallback placeholder string is `No description provided.` (a short YAML-safe non-empty constant, kept local to the augment arm since the frontmatter parsed cleanly — distinct from D-86-02's unparseable-source placeholder); (2) `setDescriptionScalar`'s insert position is the last frontmatter line (before the closing `---`), preserving sibling key order.

## Assumption Delta
`no-change` — The plan's deterministic detector flagged the word "fallback" (in "first-paragraph fallback") as a possible singular→plural generalization. Confirmed FALSE POSITIVE: "fallback" names the description-fallback degrade path, not an identity/abstraction change. No assumption recorded.

## Deviations from Plan

None - plan executed exactly as written. (The `prefer-includes` lint fix and one prettier reflow on this plan's own new code are normal in-task cleanup, not deviations.)

## Issues Encountered
- The safe double-quoted scalar emitter collapses a multi-line first-body paragraph's internal `\n` into a space; the SKILL-02 test expectation was written to the collapsed (single-line) form, which is the correct emitted shape.
- Two `tests/integration/*` cases fail on this branch (`provenance-invisibility`, `skill-path-resolution`). They are PRE-EXISTING and unrelated to this plan: reverting the three bridge sources to `HEAD~2` and re-running only those two tests reproduces the identical 2 failures (they exercise the pi-subagents runtime resolution surface, write their own `SKILL.md` inline, and never call `prepareStageSkills`). Recorded in `deferred-items.md`.

## Test Results
- `node --test tests/bridges/skills/*.test.ts tests/orchestrators/plugin/install.test.ts tests/platform/pi-api.test.ts`: 168 pass / 0 fail.
- Full unit suite (`npm test`): 3043 pass / 0 fail / 1 pre-existing skip.
- `npm run typecheck`, whole-repo `eslint .`, and `prettier --check` on changed files: clean.
- `npm run test:integration`: 16 pass / 2 fail — both failures pre-existing (see above).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Skill description + name compliance is complete: description-less, trigger-carrying (`when_to_use`), block-scalar, folded-`name`, and >1024-combined skills are all handled at Claude-Code parity, corruption-proof, and NREG-safe.
- Plan 04 (command neutralize) and Plan 05 (orchestrated reconcile row) are unaffected — they consume the degrade seam wired in Plan 02, which this plan did not touch.

## Self-Check: PASSED

- All modified files exist on disk; both task commits present in git history (`2c75676d`, `a81e7def`).
- `npm run typecheck` green; targeted skills/orchestrator/platform suites 168/168 pass; full unit suite 3043 pass / 1 pre-existing skip.
- Working tree clean and byte-identical to HEAD after the pre-existing-failure isolation check.

---
*Phase: 86-skill-and-command-frontmatter-compliance*
*Completed: 2026-07-26*
