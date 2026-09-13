---
phase: 260912-hqq
plan: 01
subsystem: bridges/hooks
tags: [refactor, naming, type-only, hooks-bridge]
status: complete

requires: []
provides:
  - HooksHydrationDeps (published hooks bridge type)
affects:
  - extensions/pi-claude-marketplace/bridges/hooks/index.ts (published barrel surface)

tech-stack:
  added: []
  patterns:
    - Deps suffix for dependency-bundle interfaces (EdgeDeps, SpawnDeps, ImportDeps, FetchOneDeps)

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/index.ts
    - tests/bridges/hooks/event-router.test.ts
    - tests/bridges/hooks/index.test.ts
    - tests/architecture/hooks-lifecycle.test.ts

decisions:
  - Kept the extends relation with the read port; the rename fixes the name, not the shape.
  - Added one doc sentence stating the extends is member composition, not a subtype claim.
  - Left every parameter and local variable name unchanged, per the plan's scope fence.

metrics:
  duration: ~9m
  completed: 2026-09-12
  commits: 1
  plan_head_before: 5ca172d468423392bc0e56ccedfca5dc1bbc164b

actuals:
  tokens: 6000
  tasks: 3
  commits: 1
---

# Quick Task 260912-hqq: Rename the Published Hooks Bridge Interface Summary

Renamed the published hooks bridge type `HooksHydrationReader` to
`HooksHydrationDeps` in place across 23 type positions in 5 files, closing
code-review finding IN-02 with no runtime change.

## What Was Done

The interface bundles two dependencies -- one filesystem read plus one
persisted-state load -- so naming it as a kind of reader asserted an is-a
relationship that held only structurally. The `Deps` suffix matches existing
in-repo precedent and clears the Google-style naming rule, which bans only `I`
prefixes and `Interface` suffixes.

Measured reference set before editing: **23 hits across 5 files**, matching the
plan's scope fence exactly. After the rename: 23 hits on the new identifier
across the same 5 files, zero on the old one.

| Site kind | Count | Location |
| --------- | ----- | -------- |
| `export interface` declaration | 1 | `event-router.ts:455` |
| Parameter type annotations | 4 | `event-router.ts` |
| Barrel re-export member | 1 | `bridges/hooks/index.ts` |
| `import type` specifiers | 3 | one per test file |
| Test type annotations | 13 | `event-router.test.ts`, `hooks-lifecycle.test.ts` |
| `satisfies` operand | 1 | `index.test.ts:26` |

Every site is a type position erased before runtime, so no behavior changed.

The declaration's doc comment gained one sentence recording that the `extends`
composes the port's single member into the bundle rather than claiming a
dependency bundle is a kind of file reader. The existing `D-09-05` and
`NFR-10` anchors are intact and no planning reference was introduced.

## Verification

| Gate | Result |
| ---- | ------ |
| `npm run check` | exit **0**, 4m22s wall |
| Unit tests | **6109 passed**, 0 failed, 0 skipped (baseline held) |
| Integration tests | **32 passed**, 0 failed (baseline held) |
| `npm run typecheck` | exit 0 |
| Old identifier across `extensions tests scripts docs README.md CHANGELOG.md` | **zero matches** (grep exit 1) |
| `extends HooksFileReader` | present, exactly one line |

### Three adjacent gates

| Gate | Result |
| ---- | ------ |
| `tests/architecture/hooks-lifecycle.test.ts` | 7/7 pass. The `hydrateProjectScopeForCwdWith` body regex still matches, verified non-vacuous: the test guards it with `assert.ok(match, "could not locate ...")`, so a miss fails loudly. |
| `tests/index.test.ts` | 18/18 pass, and the file is **absent from the diff** -- the construction-string pins are built from member names, which a type rename does not reach. |
| `tests/architecture/unowned-exports-census.test.ts` | 3/3 pass, file **absent from the diff** -- neither interface appears in the exact-equality census. |

`git diff --name-only 63de8980^..63de8980` lists exactly the 5 planned files.

## Deviations from Plan

None. The plan executed exactly as written.

The one discretionary choice the plan permitted -- "You may add at most one
sentence recording that the `extends` is member composition rather than a
subtype claim" -- was taken, since it documents the non-obvious reason a
`*Deps` interface extends a `*Reader` one.

## Environment Notes

`pre-commit run --files` on the five changed files passed every hook except
**TruffleHog**, which failed with `failed to read index file: .../.git/index:
not a directory`. This checkout is a linked worktree, so `.git` is a file and
TruffleHog cannot read an index. This is the sanctioned `SKIP=trufflehog` case
from CLAUDE.md, not a finding. With it skipped, all 21 remaining hooks passed,
including `npm lint`, `npm format check`, `npm typecheck`, `npm fallow` and
`npm direct coverage (changed pairs)`. No hook rewrote a file, so no follow-up
commit was needed.

`npm-format-check` did **not** need skipping -- it passed repo-wide.

The working tree retains pre-existing unrelated modifications to
`.claude/settings.json` and `.codex/config.toml`. They were never staged.

Seven unrelated `docs(...)` commits from concurrent sessions landed in this
shared checkout while this task ran, so `plan_head_before` is this commit's
true parent `5ca172d4`, not the session-start HEAD. Measured from that base,
`git rev-list --count` is 1, matching the recorded commit count.

One of those commits (`2673a589`, a source-comment path repoint) touched
`event-router.ts`, the same file this task edited. Its change was already
present in the working tree before the rename -- the pre-edit blob was
`9ec2d582`, the post-repoint version -- and it survives unmodified at HEAD.
This commit's only non-rename change to that file is the one added doc
sentence. No conflict markers are present in any of the five files.

## Commits

- `63de8980` -- refactor(hooks): name the hydration dep bundle for what it is

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` -- FOUND
- `extensions/pi-claude-marketplace/bridges/hooks/index.ts` -- FOUND
- `tests/bridges/hooks/event-router.test.ts` -- FOUND
- `tests/bridges/hooks/index.test.ts` -- FOUND
- `tests/architecture/hooks-lifecycle.test.ts` -- FOUND
- Commit `63de8980` -- FOUND in `git log`
