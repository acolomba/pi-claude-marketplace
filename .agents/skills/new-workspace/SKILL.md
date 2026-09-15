---
name: new-workspace
description: Create a git worktree for the current repository at ~/src/<repo>-<name> on a new branch features/<name>, via GSD's /gsd-workspace command. Use when the user asks to create a new workspace, worktree, or feature-branch environment for the current repo, or invokes /new-workspace <name>.
---

# New Workspace

Given a workspace `<name>`, create it by invoking GSD's `/gsd-workspace` command with
the name filled in — do not reimplement worktree creation directly.

Require exactly one argument, the workspace `<name>`. If it's missing, ask for it
before running anything.

1. Resolve the repo root and compute `repo` as its basename:
   ```bash
   repo=$(basename "$(git rev-parse --show-toplevel)")
   ```
   If this fails, report that you are not inside a git repository and stop.

2. Run `/gsd-workspace` with:
   ```
   --new --name <name> --repos . --path ~/src/<repo>-<name> --branch features/<name> --strategy worktree --auto
   ```

This also gives the new workspace an isolated `.planning/` directory and a
`WORKSPACE.md` manifest — extras `hwt` didn't produce, but consistent with how
this project already manages milestone workspaces, and not worth avoiding just
to match `hwt` exactly.
