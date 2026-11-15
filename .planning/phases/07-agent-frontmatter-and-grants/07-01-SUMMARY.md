---
phase: 07-agent-frontmatter-and-grants
plan: "01"
subsystem: bridges-skills, shared
tags: [frontmatter, refactor, skills, agents]
status: complete
requires: []
provides:
  - shared/frontmatter-repair.ts (fence scan, key span, safe scalar, repair with trigger, body helper)
affects:
  - extensions/pi-claude-marketplace/bridges/skills/*
tech-stack:
  added: []
  patterns: ["shared leaf module for helpers two bridge zones need (like shared/bom.ts)", "trigger parameter instead of a hard-coded rule"]
key-files:
  created:
    - extensions/pi-claude-marketplace/shared/frontmatter-repair.ts
    - test/shared/frontmatter-repair.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts
    - extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts
    - extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts
    - extensions/pi-claude-marketplace/bridges/skills/skill-names.ts
    - extensions/pi-claude-marketplace/bridges/skills/stage.ts
    - test/bridges/skills/frontmatter-scan.test.ts
    - test/bridges/skills/frontmatter-degrade.test.ts
decisions:
  - "repairSingleLineScalars(content, trigger) has a required inline-typed trigger; no type alias exported (D-PG7-02)"
  - "No re-exports of moved names from the skills bridge; every importer names shared/frontmatter-repair.ts (D-PG7-03)"
metrics:
  completed: 2026-11-14
  tasks: 2
actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: 7ed47afc268766c4048c0459a2230aeda75d75b9
plan_head_after: 209c0f05
---

# Phase 07 Plan 01: Shared frontmatter repair Summary

The skills bridge's line-based frontmatter helpers (fence scan, key span, safe double-quoted scalar emitter, single-line scalar repair, body-after-frontmatter) now live in `shared/frontmatter-repair.ts`. That module has no imports. The repair takes a required trigger, and the skills bridge passes `colonRepairTrigger`, so staged skill bytes do not change.

## Shared module exports (for plan 07-02)

```typescript
export function frontmatterBlockEnd(lines: readonly string[]): number;
export function keyValueEnd(lines: readonly string[], keyIndex: number, blockEnd: number): number;
export function emitSafeDoubleQuotedScalar(value: string): string;
export function colonRepairTrigger(value: string): boolean;
export function repairSingleLineScalars(content: string, trigger: (value: string) => boolean): string;
export function extractBodyAfterFrontmatter(content: string): string;
```

`grep -c "^import " shared/frontmatter-repair.ts` = 0. The empty-value and `UNREPAIRABLE_VALUE` tests run before `trigger(value)` in `repairableScalar`.

## Commits

| Task | Commit | Title |
|------|--------|-------|
| 07-01-01 | c8133e45 | refactor(skills): read the fence and key span from a shared module (7 files) |
| 07-01-02 | 209c0f05 | refactor(skills): share the frontmatter repair with a trigger parameter (5 files) |

Both commits passed the full commit hook, including `npm run check:commit` and gitlint. Neither used `--no-verify`.

## Verification evidence

Task 07-01-01:
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/shared/frontmatter-repair.test.ts "test/bridges/skills/*.test.ts"`: 228 tests, 228 pass, 0 fail.
- `npm run test:coverage:direct -- <5 sources>`: exit 0, 100% direct coverage. The span scanner needed no added row because its own rows already cover every branch.
- `npm run test:cucumber:profile -- --profile adapter features/skill/frontmatter.feature features/skill/listing.feature`: exit 0, 27 scenarios and 280 steps passed.
- `test/bridges/skills/stage.test.ts` and `frontmatter-degrade.test.ts` were not edited in this commit.

Task 07-01-02 (TDD):
- RED: the new owner cases ran before the move and failed at load with `SyntaxError: The requested module '../../extensions/pi-claude-marketplace/shared/frontmatter-repair.ts' does not provide an export named 'colonRepairTrigger'` (1 file-level failure).
- GREEN: the same command ran after the move: 251 tests, 251 pass, 0 fail.
- `npm run test:coverage:direct -- shared/frontmatter-repair.ts bridges/skills/frontmatter-degrade.ts bridges/skills/stage.ts`: exit 0.
- `npm run test:cucumber:profile -- --profile adapter features/skill`: exit 0, 100 scenarios and 1241 steps passed.
- `git diff --quiet HEAD -- test/bridges/skills/stage.test.ts`: exit 0 (not edited).

Node: the repository's local Node (CI pins 24). The orchestrator still has to run the full `npm run check` wave gate.

## Test rows

- Moved unchanged: every `frontmatterBlockEnd` and `keyValueEnd` row (task 1), and every `repairSingleLineScalars` row (task 2). The only change to a moved repair call is the added second argument `colonRepairTrigger`.
- Added (task 2, from the behavior list): ten rows for the always-true trigger, covering an empty value, double-quoted, single-quoted, flow sequence, flow mapping, `|`, `>`, a multi-line plain scalar, no opening fence, and no closing fence. Also added: a star trigger quoting `tools: *` to `tools: "*"`, a star trigger leaving a refused line byte-identical, three `colonRepairTrigger` rows, three `emitSafeDoubleQuotedScalar` rows (backslash before quote, LF, CRLF), and five `extractBodyAfterFrontmatter` rows (LF, CRLF, lone CR, `---x` close, indented `---`).

## Deviations from Plan

None that change the design. Under the always-true trigger, my first draft of the empty-value row also had a sibling `name: helper` line, which that trigger quotes as it should. I dropped the sibling from the new row. The moved colon-trigger row with the same input is unchanged.

## Flagged assumptions (from the plan)

- Task 07-01-01 is the tracer: it is the first path through the new module, and every skill install finds its closing fence and key spans there. Task 07-01-02 adds the trigger.
- Task 07-01-01 touches seven files, three of which change one import line each. A re-export would have been an indirection with no reader.
- "Tests stay byte-identical" (D-PG7-03) holds for the cases, not for their file. Moved rows are unchanged, and `test/bridges/skills/stage.test.ts` is unedited.
- The Wave 0 harness items of 07-VALIDATION.md land in plans 07-03 and 07-05, not here.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-07-01 is mitigated: the emitter moved unchanged, and the always-true-trigger rows prove that the empty-value and opener guards run before the trigger.

## Parent lines

- 07-VALIDATION.md / STATE.md: plan 07-01 is complete (PG-AGENT-05 foundation only; the requirement is not complete until 07-02 wires the agents reader).
- Wave 1 gate: the orchestrator still has to run `npm run check` on the tree at 209c0f05 or later.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/shared/frontmatter-repair.ts
- FOUND: test/shared/frontmatter-repair.test.ts
- FOUND: c8133e45, 209c0f05 (ancestors of HEAD)
