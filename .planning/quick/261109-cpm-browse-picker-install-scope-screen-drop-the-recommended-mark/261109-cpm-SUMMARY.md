---
quick_id: 261109-cpm
phase: quick-261109-cpm
plan: 01
subsystem: edge/browser
tags: [browse, picker, scope-screen, parity]
requirements: [BROWSESCOPE-01]
status: complete
completed: 2026-11-09
key-files:
  modified:
    - extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts
    - test/edge/browser/plugin-browser.test.ts
    - features/plugin/browse.feature
    - .agents/skills/cucumber/rules/layout.md
decisions:
  - "D-BG-1203: the install-scope screen drops `(Recommended)` and keeps its order (supersedes D-BG-1202)"
actuals:
  tasks: 2
  commits: 1
plan_head_before: 9a3982262f7adfaf58e3e2b20176e3bb77b7bd6c
plan_head_after: 80eadf5f133ec333b165e24cd28b2904c582d2a9
---

# Quick 261109-cpm: drop the recommended marker from the browse picker's install-scope screen

The browse picker's install-scope screen now lists `Project local`, `Project`, and `User (global)`, in that order, with no `(Recommended)` marker. Each row still commits as before (`project-local` -> project scope with `local: true`). Decision D-BG-1203 supersedes D-BG-1202.

- BASE: `9a3982262f7adfaf58e3e2b20176e3bb77b7bd6c`
- Worktree: `/home/acolomba/pi-claude-marketplace/.claude/worktrees/agent-ab12be867fc142763`, branch `worktree-agent-ab12be867fc142763`
- Node: v26.13.0

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 | `80eadf5f` | `fix(browse): drop the recommended marker from the scope screen` |
| 2 | none | Per the coordinator amendment, the records go under `## Parent lines` below; Task 2 makes no commit. |

## Red proof (unchanged source, edited tests and scenarios)

1. `node --import <worktree>/test/platform/isolated-pi-home.ts --test test/edge/browser/plugin-browser.test.ts` -> exit 1. 61 pass, 1 fail. The failing case is `PluginBrowser :: scope screen names the config each choice installs into` (deepStrictEqual at line 601): actual first row `'Project local (Recommended)'`, expected `'Project local'`. The renamed case `PluginBrowser :: available plugin offers Install -> Scope screen -> Project local commits project scope with local:true` passed on the old source, as the plan predicted, because its substring `Project local` is still on screen.
2. `npm run test:cucumber:profile -- --profile adapter --name 'installs the plugin in the user scope' --name 'Choosing Project local in the terminal picker'` -> exit 1. `2 scenarios (2 failed)`, `31 steps (21 passed, 8 skipped, 2 failed)`.
   - `Choosing User (global) in the terminal picker installs the plugin in the user scope (D-BG-1203)` (browse.feature:84) failed at `Then the plugin picker shows the screen "Install app @ tools: Select Scope" with these rows:`, on the first row's label (`+ 'Project local (Recommended)'`, `- 'Project local'`).
   - `Choosing Project local in the terminal picker installs the plugin and declares it in the project's local config` (browse.feature:132) failed at `When the user chooses "Project local" in the plugin picker`: `the screen Install lint @ extras: Select Scope has no single row Project local: ["Project local (Recommended)","Project","User (global)"]`.
   - Neither failure was a Pi ready timeout.

## Green runs (after the source edit)

- `node --import <worktree>/test/platform/isolated-pi-home.ts --test test/edge/browser/plugin-browser.test.ts` -> exit 0, 62/62 pass.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts` -> exit 0 (100% direct coverage kept).
- `npm run test:cucumber:profile -- --profile adapter features/plugin/browse.feature` -> exit 0, `10 scenarios (10 passed)`, `122 steps (122 passed)`. The plan said nine scenarios; the file holds ten at BASE, and all pass.
- `npm run check:features` -> exit 0.
- Gate greps, all as targeted: no `(Recommended)` in the three code files; label order `label: "Project local"|label: "Project"|label: "User (global)"|`; the aligned `| Project local | Install in the local config` row count 1; the `Project local` choice step count 1; feature IDs `D-BG-1201 D-BG-1203 `; layout.md title with `(D-BG-1203)` count 1.
- The scope-screen description cells did not change: the fixed 32-cell label column kept every description at its 84-character cut, as the planner measured.
- README and docs search `! grep -rqF '(Recommended)' README.md README.es.md docs` -> no match (grep exit 1), so no README or doc edit.
- Commit hook (`npm run check:commit` on the four staged files): passed (gitlint, prettier, markdownlint, TruffleHog, and `npm run check:commit` all Passed).
- `npm run check` in the worktree: exit 0 at `80eadf5f` (Node v26.13.0): static checks, unit, integration, cucumber adapter 1779/1779 and builtin 153/153 scenarios, and direct coverage (352 LCOV records) all passed. The batch coordinator still runs `npm run check` on the merged tree in the main checkout, per AGENTS.md "Build verification".

## Deviations from Plan

1. **[Coordinator amendment] Task 2 records not written.** `.planning/PROJECT.md`, `.planning/BACKLOG.md`, and `CHANGELOG.md` are unchanged; their texts R1 to R4 are under `## Parent lines`, ready to paste. Task 2's `<verify>` therefore does not apply in the worktree.
2. **[Environment] node_modules was a real directory, not a symlink.** The repository's `SubagentStart` hook (`scripts/init-worktree.sh`) had already run `npm install` in the worktree, so the `node_modules` symlink step was skipped. The directory is gitignored, so it does not block the merge, and there is no symlink to remove.
3. **[Environment] Shell guard.** The session's command guard refused compound lines and `$PWD` in `--import`, so the verify parts ran one at a time with the absolute worktree path. Every part exited 0.
4. **[Environment] SUMMARY location.** The harness refused writes outside the worktree, so this SUMMARY was written to the session scratchpad (`/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-behavioral-gaps/9d7180bb-0c10-4789-9fa7-2c2c30d0c974/scratchpad/cpm/261109-cpm-SUMMARY.md`) for the coordinator to copy to the primary checkout.

## Questionable choices

1. **A new decision ID, D-BG-1203, instead of a `D-BG-1202 reversed` row** (the D-PL9-08 precedent). Chosen so the scenario title cites one ID. Alternative not taken: a reversed marker on D-BG-1202 leaves no ID for the order that the user kept. Low.
2. **The `User (global)` scenario title now cites D-BG-1203, and the layout.md Phase 12 seeds line follows it.** Alternative: keep `(D-BG-1202)`, which would cite a superseded decision. Low.
3. **The renamed unit case's substring assertion passes with or without the marker**; the exact-rows case is the unit red proof. Alternative: a negative assertion in the renamed case. Not taken, because the exact-rows case already pins every label. Low.
4. **No new scenario**: the two edited scope-screen scenarios are the red proofs that AGENTS.md "Behavioral tests" asks for, and both failed on the old source. Low.
5. **BROWSESCOPE-01 keeps its `Noted` paragraph**, which still shows the old rows, and gains a `Narrowed` paragraph (the BLTOWNER-01 form). Alternative: rewrite the first paragraph, which would lose the record of what was noted. Low.
6. **`.planning/DUBIOUS-CHOICES.md` is not edited**: six batch items would change adjacent lines of its list, so the status lines go to the parent below. Low.
7. **The cursor still starts on `Project local`**, because the user kept the order (T-cpm-02). Alternative: start on `User (global)` like Claude Code's first option; not taken, because it is part of the reorder that BROWSESCOPE-01 keeps open. Medium.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Parent lines

### .planning/PROJECT.md

Insert this row on the line right after the D-BG-1202 row (find it with `grep -n 'D-BG-1202 (' .planning/PROJECT.md`):

```text
| **D-BG-1203 (behavioral-gaps, quick 261109-cpm, decided by the user on 2026-11-09, see DUBIOUS-CHOICES.md P12-DC-04): the install-scope screen drops `(Recommended)` and keeps its order**: `Project local`, `Project`, `User (global)`. It supersedes D-BG-1202. | Claude Code 2.1.319 marks none of its scope options recommended (function `xu` in the binary). The user kept Pi's order, so the order and the option wording still differ from Claude Code's, which lists `Install for you (user scope)` first. BACKLOG BROWSESCOPE-01 carries both. | ✓ Good |
```

In the D-BG-1202 row, change only the last cell: `| -- Revisit |` becomes `| Superseded 2026-11-09 by D-BG-1203 |`. The decision and rationale cells stay byte for byte.

### .planning/BACKLOG.md

Append this paragraph to the `## BROWSESCOPE-01: the picker's install-scope screen differs from Claude Code's` entry, after its `Noted 2026-11-08 ...` paragraph and one blank line. The heading and the `Noted` paragraph stay; the entry stays open.

```text
Narrowed 2026-11-09 (quick 261109-cpm, D-BG-1203): at the user's request, the picker no longer marks `Project local` as `(Recommended)`. It still lists `Project local`, `Project`, and `User (global)`, in that order. Two differences stay open: Claude Code's order (user, project, local) and its option wording. Candidate direction: reorder the screen to user, project, project local, and update the scope-screen rows that the `Choosing User (global) in the terminal picker ...` scenario of `features/plugin/browse.feature` pins.
```

### CHANGELOG.md

Insert this sub-bullet under the `## [Unreleased]` entry, right after `  - The browse picker's marketplace rows now count ...` and before `  - Internal: ...`, indented two spaces like its siblings, with no PR number (18 words; one sentence, no semicolon, no modal, no dash between statements):

```text
  - The browse picker no longer marks `Project local` as `(Recommended)` when it asks where to install a plugin.
```

### .planning/DUBIOUS-CHOICES.md

In "Decisions waiting on you", the list item:

```text
- P12-DC-04: the picker's install-scope screen drops `(Recommended)`
  (reverses D-BG-1202; the rest of BROWSESCOPE-01 stays open).
```

becomes:

```text
- P12-DC-04: the picker's install-scope screen drops `(Recommended)`
  (fixed by quick 261109-cpm, D-BG-1203 supersedes D-BG-1202; the rest of
  BROWSESCOPE-01 stays open).
```

In the Phase 12 list, the line:

```text
- **P12-DC-04 (High, fix before the PR: the user asked to drop the `(Recommended)` marker).** Install-scope screen kept as is (D-BG-1202).
```

becomes:

```text
- **P12-DC-04 (High, fixed by quick 261109-cpm: the user asked to drop the `(Recommended)` marker).** Install-scope screen drops the marker and keeps its order (D-BG-1203, supersedes D-BG-1202).
```

No STATE.md or ROADMAP.md lines; the quick-batch workflow records the task.
