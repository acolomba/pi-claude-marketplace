---
phase: 93-substitution-completion
plan: 01
subsystem: substitution
tags: [skills-bridge, vars, substitution, tracer]
requires:
  - shared/vars.ts::substituteClaudeVars (pre-existing two-variable helper)
  - bridges/skills/stage.ts (pre-existing prepare/commit staging)
provides:
  - substituteClaudeVars resolving the four-variable set single-pass
  - StageSkillsInput.cwd (optional project-scope install cwd)
  - skills-bridge feeding skillDir + scope-gated projectDir
affects:
  - plan 93-02 (orchestrator cwd threading for the SUB-02 production arm)
tech-stack:
  added: []
  patterns:
    - single-pass alternation replacer (String.replaceAll with a function)
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/vars.ts
    - extensions/pi-claude-marketplace/bridges/skills/stage.ts
    - extensions/pi-claude-marketplace/bridges/skills/types.ts
    - tests/shared/vars.test.ts
    - tests/bridges/skills/stage.test.ts
decisions:
  - "${CLAUDE_SKILL_DIR} reuses the already-computed, assertPathInside-guarded targetDir as its value rather than recomputing."
  - "Optional vars fields typed `?: string | undefined` to satisfy exactOptionalPropertyTypes while allowing explicit `undefined` (scope-gated pass-through)."
metrics:
  duration: ~25m
  completed: 2026-08-03
actuals:
  tokens: 2662
  tasks: 2
  commits: 2
status: complete
---

# Phase 93 Plan 01: Substitution Completion (skills tracer) Summary

Extended the shared `substituteClaudeVars` primitive to a single-pass
alternation replacer over the four `${CLAUDE_*}` variables and wired both
skills-bridge call sites to feed `skillDir` (SUB-01) and scope-gated
`projectDir` (SUB-02), proving the substitution architecture end-to-end on
the skills surface.

## What was built

- `shared/vars.ts`: `ClaudePluginVars` gains optional `skillDir` /
  `projectDir`. `substituteClaudeVars` reimplemented as one `replaceAll` over
  `/\$\{(CLAUDE_PLUGIN_ROOT|CLAUDE_PLUGIN_DATA|CLAUDE_SKILL_DIR|CLAUDE_PROJECT_DIR)\}/g`
  with a replacer that maps token→field and returns the matched literal when
  the mapped value is `undefined`. This structurally guarantees three
  properties in one construct: absent field → literal pass-through (never
  empty string); unknown `${...}` → untouched; and T-03-01 no-re-expansion
  (the single left-to-right scan never re-reads an inserted value — closing
  the latent cross-pass re-expansion gap the prior chained `replaceAll` had).
- `bridges/skills/stage.ts`: `prepareStageSkills` destructures `cwd`; the
  per-skill loop builds one `ClaudePluginVars` object
  (`skillDir = targetDir`, `projectDir = scope === "project" ? cwd : undefined`)
  and passes it to both the `augmentSkillDescription` call and the whole-file
  `substituteClaudeVars` call. `augmentSkillDescription`'s `vars` param
  widened from `{ pluginRoot; pluginData }` to `ClaudePluginVars`.
- `bridges/skills/types.ts`: `StageSkillsInput.cwd?: string` (optional;
  feeds substitution only).
- Tests: end-to-end project/user scope arms in `stage.test.ts`; helper
  contract assertions in `vars.test.ts`.

## Verification

- `node --test tests/shared/vars.test.ts` → 12 pass, 0 fail.
- `node --test tests/bridges/skills/stage.test.ts` → 29 pass, 0 fail.
- `npx tsc --noEmit` → exit 0.
- `eslint` + `prettier --check` on all five changed files → clean.

Note on `npm run check`: the full pipeline includes `test:integration`,
whose two pi-subagents integration tests resolve the peer from the global
npm root and fail LOCALLY on a stale global version (a known environment
issue, not a regression from this plan). Typecheck, lint, format, and both
directly-affected test suites are green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Optional vars fields must permit explicit `undefined`**
- **Found during:** Task 1 typecheck (`exactOptionalPropertyTypes: true`).
- **Issue:** The plan's `projectDir: scope === "project" ? cwd : undefined`
  yields `string | undefined`, which `readonly projectDir?: string` rejects
  under `exactOptionalPropertyTypes`.
- **Fix:** Typed both new optional fields `?: string | undefined`, matching
  the plan's explicit-`undefined`-means-pass-through contract.
- **Files modified:** extensions/pi-claude-marketplace/shared/vars.ts
- **Commit:** a2a67676

**2. [Rule 3 - Blocking] Lint auto-fixes**
- **Found during:** Task 1 lint.
- **Issue:** `import-x/order` (type-import ordering), `padding-line-between-statements`,
  and `prefer-nullish-coalescing` (`value === undefined ? matched : value`).
- **Fix:** `eslint --fix` for ordering/padding; hand-changed the replacer to
  `value ?? matched` (equivalent — `value` is `string | undefined`, never null).
- **Files modified:** stage.ts, stage.test.ts, vars.ts
- **Commit:** a2a67676

## Tooling note (not a code deviation)

`trufflehog` cannot scan inside this worktree — `.git` is a file, not a
directory, so the hook fails to read `.git/index`. Both commits used the
sanctioned `SKIP=trufflehog` prefix per CLAUDE.md; the diff is pure
substitution logic and tests with placeholder paths (no secret material).

## Success Criteria

- SUB-01: `${CLAUDE_SKILL_DIR}` resolves to the skill's installed dir —
  proven by the project-scope stage test.
- SUB-02 (skills arm): project-scope `${CLAUDE_PROJECT_DIR}` resolves to cwd;
  user scope stays literal — proven by both scope arms.
- T-03-01 preserved and strengthened: no re-expansion — proven by the
  placeholder-injection property test.

## Known Stubs

None. The SUB-02 production delivery through the orchestrators lands in plan
93-02 (per the plan objective); the skills arm here is complete and tested.

## Self-Check: PASSED

- All five modified files present on disk.
- Both commits (a2a67676, aa49d3f8) present in git history.
