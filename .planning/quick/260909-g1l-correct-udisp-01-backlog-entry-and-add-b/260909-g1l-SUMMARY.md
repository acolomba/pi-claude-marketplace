---
phase: 260909-g1l
plan: 01
subsystem: planning-docs
tags: [backlog, documentation, uninstall, plugin-manifest]
status: complete

requires: []
provides:
  - "UDISP-01 corrected: real `rm()` citation, no cross-scope prescription, both upstream behaviors recorded, resolution locked"
  - "PMAN-01 filed: bare `<pluginRoot>/plugin.json` is never read"
affects:
  - .planning/BACKLOG.md

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/BACKLOG.md

decisions:
  - "UDISP-01 resolution locked: match the Claude Code CLI -- delete plugin data silently, with `--keep-data` as the opt-out. Forced by `applyPluginUninstalls()`, which fires non-interactively from `resources_discover` / `session_start` and has no command line to carry a flag."
  - "The cross-scope last-remaining-scope check is dropped from UDISP-01. Upstream's data directory is global; ours is partitioned per scope (`dataRoot`, `persistence/locations.ts:165`), so the data-loss case cannot happen here."
  - "New backlog ID `PMAN-01` (plugin manifest). Chosen because `grep -c 'PMAN' .planning/BACKLOG.md` returned 0 and it sits next to the existing `PSRC-01` (plugin source) and `PDEP-01` (plugin dependencies) mnemonics."

metrics:
  duration: ~5 minutes
  completed: 2026-09-09T15:51:52Z

actuals:
  tokens: 2912
  tasks: 3
  commits: 1
plan_head_before: b456aee3e50108516e3a4725fea02ee3ed79ae53
---

# Quick Task 260909-g1l: correct UDISP-01 and file PMAN-01 Summary

Corrected three wrong claims inside `UDISP-01` and filed `PMAN-01`, a new entry
recording that a bare `<pluginRoot>/plugin.json` is never read at either of the
two hardcoded call sites.

## What changed

**`UDISP-01`** (documentation-only, one entry):

- The `rm()` citation now points at `orchestrators/plugin/uninstall.ts:429`,
  the line the code occupies. Neither `uninstall.ts:635` nor `line 635`
  survives anywhere in the file.
- The `**Claude Code's actual behavior:**` paragraph was replaced with a
  reading of the installed CLI v2.1.236, carrying all four flags as a GFM
  table, plus the two clarifications (no `--delete-data`; `-y` gates the
  `--prune` confirmation specifically).
- A `**Corrected 2026-09-09: ...**` paragraph records why the cross-scope check
  belongs to upstream's global data directory and not to our per-scope
  `dataRoot` (`persistence/locations.ts:165`), so it is not re-added.
- The false closing sentence of `**Our behavior today**` ("lost on uninstall
  even when the plugin remains installed in the other scope") is gone. It was
  the removed prescription restated as a fact, so it went in the same edit.
- Both upstream behaviors are now recorded -- the CLI deletes with no prompt,
  the interactive `/plugin` interface shows the data directory size and prompts
  -- followed by a `**Resolution, decided 2026-09-09**` block naming
  `applyPluginUninstalls()` as the reason a promptless default is forced.
- The `**Two call sites**` paragraph was folded into that resolution block. It
  no longer says the two paths need the same "scope-aware rule"; there is no
  scope-aware rule any more.
- `Direction for later` lost the whole cross-scope prescription and gained a
  one-line statement that no cross-scope check is needed. The closing GC-sweep
  sentence is unchanged.
- `Code seams` drops `orchestrators/plugin/shared.ts` (it was there only for
  the removed check) and gains `persistence/locations.ts`.

**`PMAN-01`** (new entry, appended between `SWTEST-01` and the trailing
pruned-items HTML comment): both hardcoded call sites, the four
official-marketplace plugins that ship the bare form, the three independent
reasons no component is dropped today, the raw relative-path dedup trap with
its 8-and-2 spurious-warning counts, the decided fix shape, and the
absent-manifest scope boundary.

## ID chosen for the new entry, and why it was free

`PMAN-01` -- "plugin manifest". Verified free before writing:
`grep -c 'PMAN' .planning/BACKLOG.md` returned 0. It follows the file's scheme
(topical mnemonic plus `-01`) and sits beside the existing `PSRC-01` (plugin
source) and `PDEP-01` (plugin dependencies). Nothing was renumbered and no
index was added, because the file has none.

## Where the suggested wording was tightened

Two places, both forced by the plan's own Task 1 gate
(`ADDED | grep -ac 'delete-data'` must be `<= 1`), and both preserving the
facts the plan required:

1. In the behavior block, the plan suggested two sentences that each name
   `--delete-data`. They were merged into one: "There is no `--delete-data`.
   ... The required mutex pair this item was first framed against is the
   competitor's model, not upstream's, and is the wrong one to copy." The
   mutex is still recorded as the competitor's model, and it is still marked
   as the wrong one to copy.
2. In `Direction for later`, the suggested "no `--delete-data`, matching
   upstream exactly; inventing one would add a flag Claude Code does not have"
   became "matching upstream exactly. Do not add a delete flag; upstream has
   none, and inventing one would copy the competitor's model instead." Same
   guidance, without a third occurrence of the literal flag name.

The three pre-existing correct mentions of the mutex were NOT deleted: the
`Surfaced` provenance paragraph is byte-identical, and the absence statement
and the do-not-invent guidance both survive in the rewritten blocks.

Everything else was written close to the suggested wording, with minor
rewrapping to hold the file's ~76-column prose width.

## Did a pre-commit hook rewrite the file?

No. `pre-commit run --files .planning/BACKLOG.md` reported no rewriting hook
and no "files were modified" line. `mdformat`, `markdownlint-cli2`, `prettier`
and the three rewriting `texthooks` all reported "no files to check" for this
path, and all four `npm-*` local hooks skipped. The hooks that did run
(`trailing-whitespace`, `fix end of files`, `fix utf-8 byte order marker`,
`Normalize irregular space characters`, `Forbid ... BiDi control characters`,
and the rest) all passed on the first run, so nothing had to be re-staged.

`trufflehog` failed with the known structural linked-worktree error
(`failed to read index file: ... .git/index: not a directory`). It was cleared
first by a filesystem-mode scan over the changed path --
`trufflehog filesystem .planning/BACKLOG.md --results=verified,unknown --fail`
exited 0 with `verified_secrets: 0` and `unverified_secrets: 0` -- and the
commit then used `SKIP=trufflehog` and nothing else. A confirming re-run with
`SKIP=trufflehog` exited 0 with no failures.

## Verification

| Gate | Result |
|---|---|
| Task 1 gate script | `TASK1-GATES-PASS` |
| Task 2 gate script | `TASK2-GATES-PASS` |
| Task 3 gate script (post-commit) | `TASK3-GATES-PASS` |
| `pre-commit run --files .planning/BACKLOG.md` | clean (trufflehog skipped per the worktree rule above) |
| filesystem `trufflehog` scan | exit 0, 0 verified, 0 unverified |

No `npm run check`, `npm test` or `npm run typecheck` was run. Zero source and
zero test files were touched, and all four `npm-*` pre-commit hooks are
`files:`-filtered to `extensions/`, `tests/` and repo-root config, so none of
them would fire on this change.

By-eye checks the gates cannot make: the correction paragraph is met before any
recommendation; nothing left in the entry implies that uninstalling in one
scope destroys the other scope's data; the entry reads as one item rather than
an original with a patch stapled on; and in `PMAN-01` the regression trap has
its own bolded lead-in immediately before `Direction for later`, so it cannot
be read as an afterthought.

## Deviations from Plan

Two wording tightenings, described in full under "Where the suggested wording
was tightened" above. Both were required to satisfy the plan's own Task 1
`A4-mutex` gate, and neither drops a fact the plan required. No other
deviation.

No STATE.md or ROADMAP.md mutation was performed: this is a quick task, not a
roadmap phase, and the orchestrator owns the docs commit.

## Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1-3 | UDISP-01 correction + PMAN-01 filing, gated and committed as one atomic change (the plan's Task 3 owns the single commit) | `9a8f740b` | `.planning/BACKLOG.md` |

## Self-Check: PASSED

- `.planning/BACKLOG.md` exists and carries both `## PMAN-01: ` and
  `uninstall.ts:429`; `uninstall.ts:635` count is 0.
- Commit `9a8f740b` exists on `features/manifest` and carries exactly one file,
  `.planning/BACKLOG.md`, with no deletions.
- `git status --porcelain -- .planning/BACKLOG.md` is empty.
