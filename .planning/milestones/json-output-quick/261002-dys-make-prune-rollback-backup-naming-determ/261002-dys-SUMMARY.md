---
phase: 261002-dys
plan: 01
quick_id: 261002-dys
status: complete
subsystem: orchestrators/plugin (prune rollback)
tags: [prune, notify-corpus, determinism, TEXT-01]
requires: []
provides:
  - PruneRestoreOps.createBackupRoot injected backup-root creator
  - NODE_PRUNE_RESTORE_OPS Node binding in operations.ts
  - reproducible prune.test.ts notify-corpus entries
affects:
  - .planning/phases/01-presentation-model/notify-corpus/baseline.jsonl
tech-stack:
  added: []
  patterns:
    - module-private Node binding at the composition owner (as NODE_FETCH_STATUS)
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
    - tests/orchestrators/plugin/prune-rollback.test.ts
    - tests/orchestrators/plugin/prune.test.ts
    - .planning/phases/01-presentation-model/notify-corpus/baseline.jsonl
decisions:
  - Prune backup-root creation is injected through PruneRestoreOps; production binds bare Node mkdtemp and rm once in operations.ts (no corpus normalizer, per the user decision of 2026-10-02)
metrics:
  duration: 40m
  completed: 2026-10-02
actuals:
  tokens: 12500
  tasks: 3
  commits: 3
plan_head_before: 6394ac1c3275483315935bf305a2154a313cd455
plan_head_after: 741581f8c2ffe2b662ff2e3630e678160687a1a6
---

# Quick 261002-dys: Make prune rollback backup naming deterministic Summary

Prune now creates its backup root through an injected `PruneRestoreOps.createBackupRoot`. Production binds Node's `mkdtemp` and `rm` once in `operations.ts`. Tests inject a creator that always names the directory `prune-backup-ABC123`. As a result, the 8 prune rollback messages in the TEXT-01 corpus are byte-stable, and `node scripts/notify-corpus.mjs check` passes.

## Commits

| Task | Commit | Title | Change |
| ---- | ------ | ----- | ------ |
| 1 | `da47d5f2` | refactor(prune): inject the backup directory creator | Adds `createBackupRoot` to `PruneRestoreOps`, read by `preparePruneRollback` with the `<extensionRoot>/prune-backup-` prefix. `createPrunePlugin` takes `restoreOps: PruneRestoreOps` as a fourth parameter, and `prune.ts` no longer imports `node:fs/promises`. `operations.ts` adds the module-private `NODE_PRUNE_RESTORE_OPS = { createBackupRoot: mkdtemp, removeBackup: rm }` and passes it from `createPruneOperation`, whose signature is unchanged. Both test files gain the `restoreOps` stub. One prune case and one rollback case now assert the exact name, and a new rollback case ("names the backup root with Node's mkdtemp under the extension root") proves the real wiring with `/^prune-backup-[A-Za-z0-9]{6}$/`. |
| 2 | `be690d6f` | test(prune): name the fixed backup directory in rollback cases | The other seven rollback-failure cases in prune.test.ts expect `prune-backup-ABC123` literally. All `readdir` name lookups, `assert.ok` guards, and wildcard name regexes are gone. Only the two empty-listing filters remain (lines 364 and 719). |
| 3 | `741581f8` | test(notify): re-capture the prune corpus entries | Splices the 37 freshly captured prune.test.ts entries into `baseline.jsonl` via `parseCorpus`/`serializeCorpus`: 8 insertions and 8 deletions. |

TDD: RED was observed before the production change. With the stub in place and `mkdtemp` still inline, exactly the two exact-name cases failed (`actual: 'prune-backup-hI3eJQ'`, expected `'prune-backup-ABC123'`), with 63 passing. GREEN: 79/79 across the prune-rollback, prune, and operations suites.

## Corpus record

All 8 changed entries are in `tests/orchestrators/plugin/prune.test.ts`, with severity `error` and argc `2`. Each changed only in its backup suffix.

| Test case | Old suffix | New |
| --------- | ---------- | --- |
| a save that writes then rejects restores state and retains the skill backup | `uTLtQM` | `prune-backup-ABC123` |
| a failed save removes newly created state and retains the skill backup | `AiBJBV` | `prune-backup-ABC123` |
| an occupied restore target reports rollback partial and retains the backup | `vN8eWF` | `prune-backup-ABC123` |
| rollback details survive a simultaneous lock-release failure (the name appears twice in this one message) | `iv3VF2` | `prune-backup-ABC123` |
| a failed state save retains a missing skill directory and restores state / a missing skill directory reports manual recovery and restores state (identical messages; the sorted baseline does not record which suffix belonged to which) | `TeVO0N`, `Zr925m` | `prune-backup-ABC123` (both) |
| a concurrent MCP edit survives failed save with its original in recovery backup / an MCP edit after a cascade with no MCP resources survives failed persistence (identical messages; same caveat) | `2Fnk86`, `Vg6xZO` | `prune-backup-ABC123` (both) |

Two pairs now become identical entries, so the 8 backup-naming entries have 6 distinct values, and prune.test.ts's 37 entries go from 27 to 25 distinct values. The baseline is a multiset, so the entry count stays 37 and the check still matches it.

Raw lines from `git diff 6394ac1c -- .planning/phases/01-presentation-model/notify-corpus/baseline.jsonl`:

```text
-{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-2Fnk86/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n    [skills] (rollback failed)\n      cause: Prune rollback requires manual directory restore at mp-orphan-skill.\n    [mcp] (rollback failed)\n      cause: Prune rollback found an occupied metadata path at mcp.json.","severity":"error","argc":2}
-{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-AiBJBV/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save rejected after create\n    [skills] (rollback failed)\n      cause: Prune rollback requires manual directory restore at mp-orphan-skill.","severity":"error","argc":2}
-{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-TeVO0N/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n    [skills] (rollback failed)\n      cause: Prune rollback requires manual directory restore at mp-orphan-skill.","severity":"error","argc":2}
-{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-Vg6xZO/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n    [skills] (rollback failed)\n      cause: Prune rollback requires manual directory restore at mp-orphan-skill.\n    [mcp] (rollback failed)\n      cause: Prune rollback found an occupied metadata path at mcp.json.","severity":"error","argc":2}
-{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-Zr925m/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n    [skills] (rollback failed)\n      cause: Prune rollback requires manual directory restore at mp-orphan-skill.","severity":"error","argc":2}
-{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-iv3VF2/manifest.json under this scope's pi-claude-marketplace directory before retrying. (lock release also failed: lock release failed) -> Prune rollback was incomplete. Inspect prune-backup-iv3VF2/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n    [skills] (rollback failed)\n      cause: Prune rollback requires manual directory restore at mp-orphan-skill.\n    [mcp] (rollback failed)\n      cause: Prune rollback found an occupied metadata path at mcp.json.","severity":"error","argc":2}
-{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-uTLtQM/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save rejected after write\n    [skills] (rollback failed)\n      cause: Prune rollback requires manual directory restore at mp-orphan-skill.","severity":"error","argc":2}
-{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-vN8eWF/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n    [skills] (rollback failed)\n      cause: Prune rollback found an occupied artifact at mp-orphan-skill.","severity":"error","argc":2}
+{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-ABC123/manifest.json under this scope's pi-claude-marketplace directory before retrying. (lock release also failed: lock release failed) -> Prune rollback was incomplete. Inspect prune-backup-ABC123/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n    [skills] (rollback failed)\n      cause: Prune rollback requires manual directory restore at mp-orphan-skill.\n    [mcp] (rollback failed)\n      cause: Prune rollback found an occupied metadata path at mcp.json.","severity":"error","argc":2}
+{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-ABC123/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n    [skills] (rollback failed)\n      cause: Prune rollback found an occupied artifact at mp-orphan-skill.","severity":"error","argc":2}
+{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-ABC123/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n    [skills] (rollback failed)\n      cause: Prune rollback requires manual directory restore at mp-orphan-skill.","severity":"error","argc":2}
+{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-ABC123/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n    [skills] (rollback failed)\n      cause: Prune rollback requires manual directory restore at mp-orphan-skill.","severity":"error","argc":2}
+{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-ABC123/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n    [skills] (rollback failed)\n      cause: Prune rollback requires manual directory restore at mp-orphan-skill.\n    [mcp] (rollback failed)\n      cause: Prune rollback found an occupied metadata path at mcp.json.","severity":"error","argc":2}
+{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-ABC123/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n    [skills] (rollback failed)\n      cause: Prune rollback requires manual directory restore at mp-orphan-skill.\n    [mcp] (rollback failed)\n      cause: Prune rollback found an occupied metadata path at mcp.json.","severity":"error","argc":2}
+{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-ABC123/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save rejected after create\n    [skills] (rollback failed)\n      cause: Prune rollback requires manual directory restore at mp-orphan-skill.","severity":"error","argc":2}
+{"file":"tests/orchestrators/plugin/prune.test.ts","message":"A plugin operation has failed.\n\n● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n    cause: Prune rollback was incomplete. Inspect prune-backup-ABC123/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save rejected after write\n    [skills] (rollback failed)\n      cause: Prune rollback requires manual directory restore at mp-orphan-skill.","severity":"error","argc":2}
```

## Isolation proof

Task 3's `<verify>` ran as written against the committed tree (HEAD `741581f8`) and exited 0 (`VERIFY_EXIT=0`). It covers these checks:

- Determinism: `cmp tmp/notify-corpus/prune-a.jsonl tmp/notify-corpus/prune-b.jsonl` found the two captures identical, at 37 lines each.
- Non-prune lines: `cmp <(grep -vF "$P" baseline@6394ac1c) <(grep -vF "$P" baseline)` found them identical. No other file's entries changed.
- Prune lines: the old lines with each 6-character suffix rewritten to `ABC123` equal the new lines (sorted `diff`, empty).
- `git diff --numstat 6394ac1c` reports `8	8`.
- Only one name is left: `grep -oE 'prune-backup-[A-Za-z0-9]+' baseline.jsonl | sort -u` returns only `prune-backup-ABC123` (13 occurrences: 9 across prune.test.ts's 8 entries, because the lock-release entry names it twice, and 4 across catalog-contract.test.ts's 3 fixed entries, because one of them names it twice). No other test file emits a random backup name.
- `scripts/` and `meta.json` are unchanged from 6394ac1c (`git diff --quiet`). No corpus normalizer exists.
- Full corpus check: `node scripts/notify-corpus.mjs check` gave `CHECK_EXIT=0` and the line `Notify corpus check passed: 3133 baseline entries present, 0 extra.`. Zero lines start with `missing in` or `extra in`. The suites reported 8737 pass, 0 fail, and 1 skipped.

## Why meta.json is unchanged

Recomputed from the committed `baseline.jsonl`: `entries` 3133, `files` 76, `argcOne` 1659, `argcTwo` 1474. These match `meta.json` exactly. The splice kept every non-prune line byte-identical, kept the prune count at 37, and changed no severity or argc. `capturedAt` (2026-10-02T02:57:59.708Z) and `nodeVersion` (v26.10.0) describe the last full `baseline` run, which this splice does not replace.

## Verification evidence

Node v26.10.0 for every command.

| Command | Exit | Commit / tree | Scope |
| ------- | ---- | ------------- | ----- |
| `node --test tests/orchestrators/plugin/prune-rollback.test.ts tests/orchestrators/plugin/prune.test.ts` (RED) | 1 (2 expected failures) | 6394ac1c + test edits | owner |
| `node --test …/prune-rollback.test.ts …/prune.test.ts …/operations.test.ts` | 0 (79 pass) | Task 1 tree before commit | owner |
| `npm run typecheck` | 0 | Task 1 tree | full typecheck |
| `node scripts/check-unused-type-members.mjs --root .` | 0 (no pin moved) | Task 1 tree | full |
| `git diff --quiet 6394ac1c -- extensions/pi-claude-marketplace/edge tests/edge tests/orchestrators/plugin/operations.test.ts` | 0 | Task 1 tree | — |
| `npm run check:changed -- --list` | — | Task 1 tree | focused ("Changed pairs and their production consumers") |
| `npx fallow audit --format json --quiet --explain --gate-marker agent` | verdict `warn` (dead-code 0, complexity 0 introduced; no duplication finding in a prune file) | Task 1 tree | new-only |
| `SKIP=trufflehog pre-commit run --files <5 files>` | 0 (prettier, npm changed checks Passed) | Task 1 tree → `da47d5f2` | focused |
| `node --test tests/orchestrators/plugin/prune.test.ts` + Task 2 greps | 0 (30 pass) | Task 2 tree | owner |
| fallow audit | `warn` | Task 2 tree | new-only |
| `SKIP=trufflehog pre-commit run --files tests/orchestrators/plugin/prune.test.ts` | 0 | Task 2 tree → `be690d6f` | focused |
| `node scripts/notify-corpus.mjs check` | 0 | Task 3 tree (staged-to-be `741581f8`) | full corpus |
| `npm run check:changed -- --list` | — | Task 3 tree | full ("Shared, removed, configuration, or unclassified inputs") |
| fallow audit | `warn` | Task 3 tree | new-only |
| `SKIP=trufflehog pre-commit run --files .planning/phases/01-presentation-model/notify-corpus/baseline.jsonl` | 0 (`PRECOMMIT_EXIT=0`, npm changed checks Passed; ran about 27 minutes, finishing 2026-10-02 15:08 UTC) | tree = `741581f8` content (`baseline.jsonl` staged, no other diff except untracked `.planning/quick/261002-dys…/` Markdown) | full: the selector's fallback, `npm run check` plus `npm run test:coverage:direct:all` |

Tasks 1 and 2 had focused task verification. Task 3's pre-commit broadened to the full check over the final code tree, and it passed. Under the unchanged-input rule in `skills/local-verification`, the orchestrator may reuse that run for commit `741581f8`. The only later additions are planning Markdown (this SUMMARY and the orchestrator's docs commit).

## Deviations from Plan

None in behavior. Small notes:

- **JSDoc wrap:** the plan asked for a "one-line JSDoc" on `createBackupRoot`. On one line it would exceed the 100-column print width, so it is a 2-line `/** */` block with the specified content.
- **Import order:** ESLint `import-x/order` requires `import type { PruneRestoreOps } from "./prune-rollback.ts"` before `./prune.ts` in operations.ts. It is placed there.
- **Task 1 GREEN coverage:** the new Node-mkdtemp case passed even at RED, because production still called `mkdtemp` inline. This is expected: it proves the real wiring, not the injection.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-261002-dys-01 holds: the only production creator is the bare Node `mkdtemp` in the module-private `NODE_PRUNE_RESTORE_OPS`, the prefix is still built from `locations.extensionRoot`, and `createPruneOperation`'s signature is unchanged, so the command edge cannot supply a creator.

## Notes for the orchestrator

- The STATE.md item "Carried concern -- corpus nondeterminism" and the matching Operator Next Steps bullet are now resolved.
- ROADMAP's milestone-invariant paragraph counts 29 approved corpus changes. The operator decides whether to record this 8-entry re-capture there, as was done for CR-01.
- Scratch files live under the gitignored `tmp/notify-corpus/` and `tmp/precommit-t{1,2}.log`. None is committed.

## Self-Check: PASSED

- FOUND: all six modified files; FOUND commits `da47d5f2`, `be690d6f`, `741581f8` on `features/json`.
