---
quick_id: 261001-jwu
status: complete
description: Optimize local checks and GSD verification
---

# Faster local checks and GSD verification

## Task 1: Cache and name existing checks

Enable TypeScript incremental state under ignored local storage and Prettier's
content cache. Keep uncached full typed ESLint. Add independent module,
architecture, and analyzer test commands while retaining the complete unit and
coverage commands. Verify cold/warm type checking and test discovery.

## Task 2: Conservative changed-file checks and local hooks

Add `check:changed` with an explicit optional base and a preview mode. Include
staged, unstaged, deleted, renamed, and untracked files. Use the installed
TypeScript parser for relative import dependencies, including type imports.
Run changed-pair coverage and affected consumer tests. Broaden for shared test
support, tool/config changes, deletions, or unresolved dependency selection.
Keep the command explicitly a feedback gate, not a replacement for completion.

Local commits use focused checks, cached formatting, incremental type checking,
and global Fallow. Move full typed lint and member analysis to the unchanged
completion chain. Retain analyzer controls on changes to their own machinery.
Update existing hook-contract tests and documentation to match this authorized
policy change; do not add YAML-layout assertions.

Verify selectors against temporary git repositories and import graphs, including
type changes, cycles, deletions, spaces, unknown paths, and git failures. Exercise
the command on representative real changes, then remove those probes.

## Task 3: GSD integration and completion

Set the existing GSD full-check timeout to 2,400 seconds. Add a small project
skill for planner/executor/verifier roles: focused task verification, full checks
at the combined-code completion boundary, and no repeated full check when the
same inputs already have recorded passing evidence. Never treat focused results
as full-check evidence. Use project configuration/instructions rather than edits
to installed GSD internals or a custom result-cache framework.

Run the full check, applicable pre-commit hooks, and Fallow audit. Record timing,
test counts, limitations, and separate code/planning commits. No PR or push.

## Threat model

Pass paths as argument arrays, preserve NUL-delimited git paths, fail on git or
child errors, and broaden rather than silently omit unknown inputs. Keep caches
local and disposable. Shared changes and removed readers still reach global
analysis at completion. GSD must rerun after source, dependency, configuration,
or environment changes; a timeout is not passing evidence.
