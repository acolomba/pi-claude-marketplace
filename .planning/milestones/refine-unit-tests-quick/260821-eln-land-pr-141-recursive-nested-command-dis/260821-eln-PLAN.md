---
id: 260821-eln
slug: land-pr-141-recursive-nested-command-dis
description: Land PR #141 -- recursive nested command discovery (CM-4)
created: 2026-08-21
mode: quick
branch: fix/nested-command-discovery
local_branch: pr-141
worktree: .worktrees/pr-141
pr: 141
contributor: rakesh-vs
---

# Quick Task 260821-eln: Land PR #141 -- recursive nested command discovery

Land external PR #141 (@rakesh-vs, "fix(commands): discover nested command
files recursively (CM-4)") complete: bring the branch up to date with `main`,
close the six findings the evaluation recorded, and write down the naming
decision the PR takes -- without rewriting the contributor's commit and without
bumping the version.

The correctness evaluation is finished and its verdict is **correct**. It lives
at `260821-eln-EVALUATION.md` in this directory. Do not redo it. Read it once
for the measured parity table and the two locked decisions, then work the
findings.

## What the contributor submitted

`bridges/commands/discover.ts` walks each declared `commands/` directory
recursively. `domain/name.ts::generatedCommandName` accepts a `/`-separated
relative path, validates each segment on its own, and joins the segments with
`:`. A file at `commands/build/web.md` becomes the command `acme:build:web`.
The PR closes issue #140, filed by the same contributor.

The evaluation measured the result against Claude Code 2.1.228 with a synthetic
plugin. Recursion and colon-joining are exact parity to arbitrary depth. Pi
needs no change: its prompt-template loader derives a name from the file
basename and its invocation matcher does not treat a colon as special, so a
staged `acme:build:web.md` registers and resolves.

## Locked decisions

These are settled. Do not revisit them and do not offer alternatives.

- **D-141-01 -- elision applies to the first path segment.** Keep the PR's
  behavior as submitted: `commands/acme-tools/lint.md` becomes
  `acme:tools:lint`. Claude Code gives `acme:acme-tools:lint`, but Claude Code
  performs no elision at all, so CM-2 already diverged for flat files. Record
  the decision and add a regression test.
- **No version bump.** Add the entry under the existing empty `## [Unreleased]`
  heading. Leave `package.json`, `package-lock.json`, `EXTENSION_VERSION`, and
  `sonar.projectVersion` at `0.17.0`. This is how PR #138 landed.
- **Do not rewrite commit `6bd79fea`.** No rebase, no amend, no force-push.
  Update the branch by merging `main` into it.

## Ground rules for every task

All work happens in the worktree at `.worktrees/pr-141` on branch `pr-141`.
Never commit to `main`.

Before each `git commit`, run `pre-commit run --all-files` and make it clean.
CI runs the hooks at that scope, so a scoped `--files` run hides pre-existing
violations until the Lint job fails. A failed hook means the commit did not
happen -- never recover with `--amend`.

In a linked worktree the `trufflehog` hook fails for a structural reason: the
worktree's `.git` is a file, not a directory, so the git-mode scan cannot find
the index. Confirm a clean filesystem scan over the paths you are about to
commit, then prefix the commit with `SKIP=trufflehog`. Do not extend `SKIP=` to
any other hook, and never use `--no-verify`.

The `prettier` hook can rewrite files during a commit and the commit still
succeeds. Run `git status` after every commit. Fix any rewrite with a follow-up
commit, never an amend.

Markdown in this repo is formatted by `mdformat`, not by prettier. Never run
`prettier --write` on a `.md` file here.

Stage explicit paths only. Do not use `git add -A` or `git add .`.

## Task 1 - Merge `main` into the branch

**Files:** none (git only)

**Action:** In `.worktrees/pr-141`, merge `origin/main` into `pr-141`.

**Rationale:** The branch forks from `8992d850` and `main` is at `fb4216df`
(finding 5). Merge, never rebase -- the contributor's commit `6bd79fea` must
survive unrewritten.

**Verify:** `git log --oneline -3` shows the merge commit above `6bd79fea`, and
`6bd79fea` is still present with its original hash.

**Done:** Merge commit on `pr-141`; the contributor's commit is unchanged.

## Task 2 - Make the PRD mdformat-clean and record D-141-01

**Files:** `docs/prd/pi-claude-marketplace-prd.md`, `.planning/PROJECT.md`

**Action:**

1. The CM-4 row at line 432 widened its cell to 442 characters while the
   header, the separator, and the five sibling rows stay at 139. `mdformat`
   re-pads the whole table, so the file as submitted is not clean and the
   `lint.yml` pre-commit job fails (finding 1). Let the hook do the re-padding;
   do not hand-align the table.
2. In the same table, state D-141-01's scope on the **CM-2** row: the
   `<plugin>-` prefix is elided from the head of the source name, and the head
   is the first path segment when the source is a nested path. Mirror the same
   sentence in **Appendix B**'s Command stripping rule.
3. Add one row to the `## Key Decisions` table in `.planning/PROJECT.md`, in
   the house form the sibling `D-NN` rows use (bold decision, then the
   rationale column, then the health column). State the accepted divergence:
   Claude Code performs no elision, so `acme-tools/lint.md` is
   `acme:acme-tools:lint` upstream and `acme:tools:lint` here; this is the same
   kind of divergence CM-2 already accepted for flat files, and it keeps the
   rule to one sentence.

**Rationale:** The PRD carries the normative requirement rows, so the rule
belongs there. `.planning/PROJECT.md` carries every other `D-NN` decision with
its rationale (D-88-08, D-90-06, D-96-02), so the decision record belongs
there. `mdformat` excludes `^\.planning/`, so the PROJECT.md edit costs no
re-padding.

**Verify:** `pre-commit run --all-files` is clean, and `git status` is clean
after it -- a hook that rewrote a file means the run was not clean.

**Done:** The PRD table is mdformat-stable, both PRD sites state the
first-segment rule, and PROJECT.md carries the D-141-01 row.

## Task 3 - Pin D-141-01 with regression tests

**Files:** `tests/domain/name.test.ts`, `tests/bridges/commands/discover.test.ts`

**Action:** Three cases. Cite `D-141-01` in each test title.

1. `generatedCommandName("acme", "acme-tools/lint")` is `"acme:tools:lint"`.
   Add a comment giving the measured upstream value (`acme:acme-tools:lint`,
   Claude Code 2.1.228) so a later reader sees the divergence is deliberate.
2. Elision does not reach a non-head segment:
   `generatedCommandName("acme", "build/acme-web")` is `"acme:build:acme-web"`.
3. The collision class, at the discover level: a commands directory holding
   both `tools/lint.md` and `acme-tools/lint.md` yields one discovered command
   and one warning naming `acme:tools:lint`. Sorted order makes `acme-tools`
   the winner, so assert the surviving `commandFile` too.

**Rationale:** `tests/domain/name.test.ts` already holds a
`CM-4 ... first segment only` case for `acme-build/web`, but nothing names
D-141-01, nothing pins the negative half, and nothing pins the collision the
decision creates. Case 3 is the decision's real cost and is the case a
regression would silently change. `discover.test.ts` already builds a two-entry
`componentPaths.commands` fixture for the D-07 first-wins test; case 3 is the
same fixture shape with one directory.

**Verify:** `npm test -- tests/domain/name.test.ts tests/bridges/commands/discover.test.ts`
passes. Then plant the violation: change the elision in
`generatedCommandName` to apply to every segment and confirm cases 1 and 2
fail, then restore.

**Done:** Three passing cases that fail on the planted change.

## Task 4 - Skip an unreadable subdirectory instead of aborting the install

**Files:** `extensions/pi-claude-marketplace/bridges/commands/discover.ts`,
`tests/bridges/commands/discover.test.ts`

**Action:** A subdirectory under `commands/` with mode 000 now aborts the whole
install with a raw `EACCES ... scandir <path>` (finding 3). Before the PR that
directory was never opened, so the plugin installed. `readDirEntriesTolerant`
tolerates `ENOENT` and `ENOTDIR` only; every other errno propagates.

Do **not** widen `readDirEntriesTolerant`. Its contract is shared with the
other discovery paths and the top-level directory case is the one it answers.

Instead, make `walkCommandsDir` tolerate a read failure on a **subdirectory**
and surface it through the `warnings[]` channel the D-07 first-wins skips
already use. Thread a `warnings: string[]` sink into `walkCommandsDir`
alongside the existing `out` array. The top-level `commands/` directory keeps
its current behavior: it is read through `readDirEntriesTolerant` and any
errno other than `ENOENT`/`ENOTDIR` still propagates. Distinguish the two by
whether `dir` equals `base`.

Write the warning in the voice of the sibling `duplicateWarning`: subject
first, lowercase, ending in a skip clause. Name the skipped path relative to
the commands directory and name the commands directory, so the message locates
the problem. Include the underlying error message.

**Rationale:** Reuse of the existing warnings channel keeps this a house
mechanism rather than a new one. The channel already reaches the user:
`stage.ts` folds `discoverWarnings` into its result and `install.ts` appends
them to `bridgeWarnings`. A directory the user cannot read is a plugin-shape
problem the install should report and continue past, exactly like a duplicate
generated name.

**Verify:** New test in `discover.test.ts`. Plant a mode-000 subdirectory under
a temp commands directory holding one readable command, and assert discovery
returns the readable command plus one warning naming the skipped path. Follow
the skip pattern already in `tests/bridges/agents/stage.test.ts`: return early
on `process.platform === "win32"`, and return early when `process.getuid()` is
0, because `chmod 0` does not block root. `chmod` the directory back to 0o755
in a `finally` before the `rm`, so a failing assertion cannot leave an
unremovable temp directory behind.

**Done:** An unreadable subdirectory produces a warning and the install
continues. The top-level directory still propagates. The test skips on win32
and as root, and always restores the mode.

## Task 5 - Restore directory context in the name error

**Files:** `extensions/pi-claude-marketplace/bridges/commands/discover.ts`,
`tests/bridges/commands/discover.test.ts`

**Action:** The safe-name error label was `command source name in <commandsDir>`
and is now `command path segment in "<source>"` (finding 6). A user with a bad
filename can no longer find the file, because `<source>` is a bare relative
path with no directory.

Keep `domain/name.ts` directory-unaware -- it is a pure module and the label is
built where the segment is validated. Fix it at the discover call site instead:
wrap the `generatedCommandName(pluginName, sourceName)` call in
`walkCommandsDir` and rethrow with the commands directory and the relative
source path, passing the original through `{ cause }`. Use `errorMessage` from
`shared/errors.ts` for the inner text, the way `fs-utils.ts` does.

Keep it surgical. Do not add a label parameter to `generatedCommandName` and do
not change any of its existing messages.

**Rationale:** The throw site knows the segment; the call site knows the
directory. Catching at the call site is the smaller change, keeps the domain
module pure, and restores strictly more context than the pre-PR message, which
named the directory but not the nested path.

**Verify:** New test in `discover.test.ts`. Plant a file whose stem fails
`assertSafeName` -- a name that elides to empty, such as `acme-.md`, reaches
the `elided command path head` throw. Assert the thrown message contains both
the commands directory and the source path, and that `error.cause` is the
original.

**Done:** A bad command filename produces an error naming its directory and its
path, with the original error preserved as the cause.

## Task 6 - Record the change and close the gate

**Files:** `CHANGELOG.md`

**Action:** One or two entries under the existing `## [Unreleased]` heading. No
version bump.

Read several existing entries first and match their voice: the user-visible
outcome leads, the mechanism follows, and the contributor is credited as
"Thanks to @rakesh-vs (#141)." at the end. State what a plugin author can now
do -- ship a command in a subdirectory of `commands/` and have it register --
and state what happened before: the file was silently dropped. If a second
entry is warranted, use it for the naming rule and the divergence D-141-01
accepts.

Then run the full gate and hand the push to the operator.

**Verify:**

1. `npm run check` in the worktree. Do not pipe it into `tail` or `head` -- a
   pipeline's exit status is the last command's, so a piped run reports success
   having verified nothing. Redirect to a file and read the file, or check the
   real exit code.
2. `pre-commit run --all-files` clean, then `git status` clean.
3. Remove the `node_modules` symlink from the worktree before any worktree
   cleanup. It shows as untracked and blocks the dirty-worktree check.

**Push:** The branch lives on the contributor's fork. A push there fails LFS
lock verification, because the pre-push hook calls the remote's lock endpoint
and the PR-scoped maintainer grant is invisible to it. The workaround is a
single-invocation config override:

```
env GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=lfs.locksverify GIT_CONFIG_VALUE_0=false \
  git -C .worktrees/pr-141 push https://github.com/rakesh-vs/pi-claude-marketplace.git \
  pr-141:fix/nested-command-discovery
```

A `--dry-run` runs the pre-push hook, so a green dry run is a real signal. Run
the dry run, then hand the operator the exact line above and let them run the
real push.

**Done:** CHANGELOG records the change, `npm run check` is green, the hooks are
clean, and the operator has the push command.

## Commits

Five atomic commits on top of the merge, Conventional Commits, ASCII only. No
milestone, phase, plan, or wave references in any message or source comment.
Source comments may cite CM-2, CM-4, D-141-01, RN-2, D-07, and D-14.

1. `docs(commands): record the nested-command elision rule`
2. `test(commands): pin first-segment elision and its collision`
3. `fix(commands): skip an unreadable command subdirectory`
4. `fix(commands): name the directory in a command name error`
5. `docs: record recursive nested command discovery`

The merge commit lands first, unsquashed.
