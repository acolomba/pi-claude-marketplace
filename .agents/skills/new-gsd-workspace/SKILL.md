---
name: new-gsd-workspace
description: Create a ready-to-use git worktree for the current repository at ~/src/<repo>-<name> on a new branch features/<name>, branched from a freshly fetched origin/main, then run the repo's scripts/init.sh in it so dependencies, GSD, skills, and agent tooling are installed. Use when the user asks to create a new workspace, worktree, or feature-branch environment for the current repo, or invokes /new-gsd-workspace <name>.
---

# New GSD Workspace

Create a worktree that is ready to use: when this skill finishes, the user can
open a new terminal, `cd ~/src/<repo>-<name>`, start an agent, and work.

Require exactly one argument, the workspace `<name>`. If it's missing, ask for it
before running anything.

Do not use GSD's `/gsd-workspace` here. Its worktree strategy nests the repo
under `<path>/<repo>/` and writes a `WORKSPACE.md` beside it. This project
wants the worktree itself at `~/src/<repo>-<name>`, like `hwt` makes it.

1. Resolve the repo and the target path once, and use these variables in every
   later command. A `~` inside quotes does not expand, so use `$HOME`:

   ```bash
   repo_root=$(git rev-parse --show-toplevel)
   repo=${repo_root##*/}
   name=<name>
   target="$HOME/src/$repo-$name"
   ```

   If `git rev-parse` fails, report that you are not inside a git repository
   and stop.

2. Validate before you create anything, and report all failures at once:

   - `$name` is kebab-case: lowercase letters and digits in words joined by
     single hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`). The name becomes both a
     branch component and a folder name, so a space or a slash would make an
     odd branch or a nested folder.
   - `$target` does not exist.
   - The branch `features/$name` does not exist
     (`git -C "$repo_root" show-ref --verify --quiet "refs/heads/features/$name"`
     succeeds when it does).

3. Fetch `main`, and check that it contains the setup script:

   ```bash
   git -C "$repo_root" fetch origin main
   git -C "$repo_root" cat-file -e origin/main:scripts/init.sh
   ```

   The branch starts from `origin/main`, not from the current `HEAD`, so it is
   never out of date, even when the local checkout is behind. If the fetch
   fails, report it and stop. Do not fall back to an older base.

4. Create the worktree:

   ```bash
   git -C "$repo_root" worktree prune
   git -C "$repo_root" worktree add --no-track -b "features/$name" "$target" origin/main
   ```

   `prune` removes the records of worktree folders that someone deleted by
   hand. Without it, `worktree add` refuses a path that git still has
   registered. `--no-track` stops the feature branch from tracking
   `origin/main`, so `git pull` and `git push` do not target `main`.

5. Run the setup script in the new worktree:

   ```bash
   bash "$target/scripts/init.sh"
   ```

   It installs npm dependencies, GSD, skills, codegraph, and the fallow agent
   wiring. It takes several minutes and can run longer than a foreground tool
   timeout, so start it detached (for example, as a background task) and wait
   for it to exit. Judge the result by its exit code.

   Near the end, the script prints "Failed" for some pre-commit hooks, such as
   the dash fixer and mdformat. This is expected. The codegraph and fallow
   installers rewrite `AGENTS.md`, and those hooks restore the committed text.
   The script ignores their exit status. Do not report these lines as a
   problem when the script exits 0 and `git status` is clean.

   If the script exits non-zero, show the end of its output and stop. Keep the
   worktree, and tell the user to fix the cause and run `scripts/init.sh`
   again from the worktree.

6. Report:

   - the worktree path, the branch, and the commit it starts from
   - whether `init.sh` succeeded
   - `git -C "$target" status --short`. The script can rewrite tracked files,
     such as `package-lock.json` or `AGENTS.md`. List any changes, and do not
     revert them.
   - next step: open a new terminal, `cd ~/src/<repo>-<name>`, and start the
     agent

Leave this session in its current directory. The user starts a new agent in
the worktree, so moving this session there would only change where its later
commands run.
