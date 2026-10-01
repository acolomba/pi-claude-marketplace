---
name: new-gsd-milestone
description: Start a new GSD milestone labeled with a kebab-case name instead of a version number, with phase numbering restarted at 1, via GSD's /gsd-new-milestone command. Use whenever the user asks to start, open, or begin a new milestone in this repo, asks to run /gsd-new-milestone, or invokes /new-gsd-milestone <name> -- even if they don't mention naming or phase numbers, because this project never uses versioned milestones or continued phase numbering.
---

# New GSD Milestone

This project labels milestones with names (`test-backlog`, `workflows-replay`)
and starts each milestone's phases at 1. GSD's `/gsd-new-milestone` does the
opposite by default: it suggests the next version (v1.19 -> v1.20) and continues
phase numbers from the previous milestone. Its workflow has no capability hook
point (those cover only discuss, plan, execute, verify, and ship), so this skill
wraps the command and overrides those two choices. Do not reimplement the
workflow -- run it and apply the overrides below as you go.

Run gsd-tools as `node .claude/gsd-core/bin/gsd-tools.cjs` from the repo root
(the workflow's `gsd_run` wraps the same file). Add `--ws <name>` to every query
when a workstream is in use.

## Inputs

Require a milestone name. If it's missing, ask for it before running anything.
If the user gives a version (`v1.20`, `1.20`), ask for a name instead -- a
version is what this skill exists to avoid.

Derive two values from the name:

- **slug** -- the milestone label: lowercase letters, digits, `-`, `.`, `_`;
  starts with a letter or digit; at most 64 characters. GSD writes it to
  STATE.md's `milestone:` field and into archive paths
  (`milestones/<slug>-phases/`), and `phases.clear` rejects any other label.
  "Workflow Replay" -> `workflow-replay`. Avoid a slug that is a leading prefix
  of an earlier one in MILESTONES.md (`workflows` vs `workflows-replay`): GSD
  finds the active roadmap heading by matching the slug at a word boundary, so
  it could match the older heading.
- **title** -- the human-readable name. Use the user's phrase as written; if
  they gave only a slug, title-case it (`test-backlog` -> `Test Backlog`). GSD's
  confirmation step (3.5) lets the user correct it.

Pass any other flags through unchanged (`--ws <name>`, `--auto`, `--text`).

## Before invoking

1. **Not on `main`.** The workflow makes three or four commits, and this repo
   forbids committing to `main`. If `git branch --show-current` prints `main`,
   stop and suggest `/new-gsd-workspace <slug>`, then rerun there.
2. **Previous milestone closed.** Run `query init.new-milestone` (read-only). If
   `phase_dir_count` is above 0 or the file at `requirements_path` exists, the
   previous milestone looks open. Ask whether to run `/gsd-complete-milestone`
   first. Nothing in the workflow detects an unclosed milestone: step 6 archives
   whatever is in the phases directory, and steps 9 and 10 overwrite
   REQUIREMENTS.md and ROADMAP.md.
3. **Workstream exists.** With `--ws <name>`, confirm the workstream exists. An
   unknown name resolves silently to paths that don't exist.

## Run

Invoke `/gsd-new-milestone` with:

```
<slug> --reset-phase-numbers [passthrough flags]
```

`--reset-phase-numbers` makes the roadmap start at Phase 1. It is not part of
the milestone name.

## Overrides while the workflow runs

- **Step 3 (Determine Milestone Version):** skip it. Don't parse MILESTONES.md
  for the last version or suggest a next one. The label is the slug.
- **Labels:** wherever the workflow writes `v[X.Y]` (the step 3.5 summary, the
  step 9 header, the roadmapper prompt, the step 11 banner), write the slug;
  wherever it writes `[Name]`, write the title. In every commit message, use the
  slug alone (`docs: start milestone <slug>`); adding the title can push the
  subject past gitlint's 72-character limit.
- **PROJECT.md (step 4):** use the house heading form
  `## Current Milestone: <slug> -- <title>`.
- **Step 5:** replace only the `state.milestone-switch` line, keeping the lines
  above it, which capture the outgoing milestone for step 6:
  ```bash
  gsd_run query state.milestone-switch --milestone "<slug>" --name "<title>" $GSD_WS_ARG
  ```
- **Step 7.5 (reset-phase safety):** step 6's `phases.clear` has already
  archived the old phase directories, so `phase_dir_count` should be 0. If it
  isn't, `phases.clear` failed (usually on uncommitted changes): stop and
  report. Never move directories to `phase_archive_path` -- GSD derives it from
  the last *versioned* MILESTONES.md entry (`v1.19-phases`), not from the
  outgoing milestone.
- **Step 10 (roadmapper):** the roadmapper is a separate subagent and cannot see
  this skill. It reads a MILESTONES.md full of `v1.x` entries, and its own spec
  uses `## vX.Y` headings. Add this to its prompt's `<instructions>`:

  > Label this milestone `<slug>` (title: `<title>`); never assign a version
  > number. Write the current milestone as a plain heading
  > `### In progress <slug> (<title>)`, not inside `<details>`, with its phases
  > numbered from 1 below it. In STATE.md keep `milestone: <slug>` and
  > `milestone_name: <title>`.

  The heading matters because GSD finds the active milestone by matching a
  heading against STATE.md's `milestone:` value. With no match, it strips every
  `<details>` block, and the new phases drop out of `roadmap.analyze` and
  `progress`.

  With `--ws`, also pass `roadmap_path`, `state_path`, and `requirements_path`
  from `init.new-milestone` and tell the roadmapper to write those files. By
  default it writes `.planning/ROADMAP.md` and `.planning/STATE.md` at the root,
  which would overwrite the root files while step 10 commits the workstream
  ones.

## Check before reporting done

- `query state.get milestone --raw` prints the slug.
- `query roadmap.analyze` reports `"scope": "complete"`. `unscoped` means no
  heading matched the slug. `roadmap.get-phase` can't catch this, because it
  falls back to searching the whole document.
- `query roadmap.get-phase 1` reports `"found": true`.
- The `phases_dir` from `init.new-milestone` holds no directories from the
  previous milestone.
- With `--ws`: `git status` shows the root `.planning/ROADMAP.md` and
  `.planning/STATE.md` unchanged.
