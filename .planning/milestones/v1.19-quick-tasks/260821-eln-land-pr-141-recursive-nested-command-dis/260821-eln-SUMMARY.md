---
id: 260821-eln
slug: land-pr-141-recursive-nested-command-dis
description: Land PR #141 -- recursive nested command discovery (CM-4)
mode: quick
status: complete
completed: 2026-08-21
branch: pr-141
worktree: .worktrees/pr-141
pr: 141
contributor: rakesh-vs
tasks_completed: 6
tasks_total: 6
---

# Quick Task 260821-eln Summary

PR #141 (@rakesh-vs) is complete on `pr-141` in `.worktrees/pr-141`. The
branch is up to date with `main`, all six evaluation findings are closed, and
D-141-01 is recorded in both the PRD and PROJECT.md. The contributor's commit
`6bd79fea` is unchanged. No version bump: `package.json`,
`package-lock.json`, `EXTENSION_VERSION`, and `sonar.projectVersion` all stay
at `0.17.0`.

## Commits

| # | Hash       | Title                                                       |
| - | ---------- | ----------------------------------------------------------- |
| 0 | `69f7caa4` | Merge remote-tracking branch 'origin/main' into pr-141       |
| 1 | `937ebd0b` | docs(commands): record the nested-command elision rule       |
| 2 | `b8d1970e` | test(commands): pin first-segment elision and its collision  |
| 3 | `066e9004` | fix(commands): skip an unreadable command subdirectory       |
| 4 | `e69e9823` | fix(commands): name the directory in a command name error    |
| 5 | `9fc24ea9` | docs: record recursive nested command discovery              |

## Task 1 -- merge `main` (finding 5)

`origin/main` (`fb4216df`) merged into `pr-141` as `69f7caa4`. No conflicts.
No rebase, no amend. `6bd79fea` survives with its original hash.

## Task 2 -- PRD and PROJECT.md (findings 1, 2)

`docs/prd/pi-claude-marketplace-prd.md`:

- The commands table and Appendix B are mdformat-stable again. `mdformat`
  did the re-padding; the table was not hand-aligned.
- CM-2 now states that the `<plugin>-` prefix is stripped from the **head**
  of the source name, and that the head is the first path segment when the
  source is a nested path, with `acme-tools/lint.md` -> `acme:tools:lint` as
  the worked case.
- Appendix B's Command stripping rule carries the same sentence.

`.planning/PROJECT.md` gains the D-141-01 row in `## Key Decisions`, health
`-- Locked`. It states the accepted divergence (`acme:acme-tools:lint`
upstream against `acme:tools:lint` here), ties it to the divergence CM-2
already accepted for flat files, and names the cost: `tools/lint.md` and
`acme-tools/lint.md` in one directory now elide to one name.

## Task 3 -- regression tests for D-141-01

`tests/domain/name.test.ts` (2 cases):

- `generatedCommandName("acme", "acme-tools/lint")` is `"acme:tools:lint"`,
  with the measured upstream value in a comment.
- `generatedCommandName("acme", "build/acme-web")` is
  `"acme:build:acme-web"` -- elision does not reach a non-head segment.

`tests/bridges/commands/discover.test.ts` (1 case): a commands directory
holding both `acme-tools/lint.md` and `tools/lint.md` yields one discovered
command (`commandFile` asserted as the `acme-tools` file, which sorted order
makes the winner) and one warning naming `acme:tools:lint`.

**Planted-violation check.** The plan predicted that cases 1 and 2 both fail
under a single mutation. They do not, and the reason is worth recording:

- Mutation A, elision applied to **every** segment: case 2 fails; case 1
  still passes, because `acme-tools/lint` has the prefix only on its head, so
  per-segment elision produces the same string.
- Mutation B, **no** elision at all (the real upstream behavior): case 1
  fails, the discover collision case fails, and four pre-existing CM-2/CM-4
  cases fail.

Both mutations were planted and reverted. Every new case bites under one of
them, so the intent of the check is met; the plan's single-mutation framing
was the imprecise part.

## Task 4 -- unreadable subdirectory (finding 3)

`bridges/commands/discover.ts` gains `readWalkEntries(dir, base, warnings)`.
The declared `commands/` directory (`dir === base`) keeps
`readDirEntriesTolerant`, so ENOENT and ENOTDIR still mean "no commands" and
every other errno still propagates. A **subdirectory** read failure is caught,
turned into a warning, and skipped. `readDirEntriesTolerant` itself was not
widened.

The warning follows `duplicateWarning`'s voice:

```text
command subdirectory "locked" in "<commandsDir>" cannot be read: EACCES: permission denied, scandir '...'; skipping subdirectory.
```

It rides the existing `warnings[]` channel, which `stage.ts` folds into
`discoverWarnings` and `install.ts` appends to `bridgeWarnings`.

Test: a mode-000 subdirectory beside a readable command. Returns the readable
command plus one warning. Skips on `win32` and as root, `chmod`s back to
`0o755` in a `finally` before the `rm`. Verified to fail against the
pre-fix `discover.ts`.

## Task 5 -- directory context in the name error (finding 6)

`domain/name.ts` is untouched. `discover.ts` gains `nameCommandInDir`, which
wraps `generatedCommandName` and rethrows as

```text
invalid command source "acme-/lint" in "<commandsDir>": <inner message>
```

with the original preserved through `{ cause }` and the inner text taken from
`errorMessage`.

Test: `commands/acme-/lint.md`, whose head elides to the empty string, reaches
the `elided command path head` throw. Asserts the directory, the source path,
and the cause. Verified to fail against the pre-fix `discover.ts`.

Note on the fixture: the plan suggested a flat `acme-.md`, but a bad **stem**
in a non-head position does not throw at all (`nested/acme-` is a legal
`acme:nested:acme-`). The elided-head throw needs the bad segment to be the
head, so the fixture is a directory named `acme-`, which also gives the
nested source path the assertion wants.

## Task 6 -- CHANGELOG and gate (finding 4)

Three entries under the existing `## [Unreleased]` heading. No version bump.

1. The nested command a plugin author can now ship, and that it was silently
   dropped before. Credited "Thanks to @rakesh-vs (#141)."
2. The elision rule and the divergence D-141-01 accepts.
3. The two robustness fixes from tasks 4 and 5.

**Deviation:** the plan allowed one or two entries. A third was added because
tasks 4 and 5 change user-visible behavior that neither of the first two
entries describes.

### Gate

`npm run check` in the worktree: **exit 0**. Not piped -- redirected to a file
and the real exit code read.

```text
typecheck -> lint -> fallow -> format:check -> test -> test:integration
tests 3611, pass 3610, fail 0, skipped 1 (pre-existing)
integration: tests 21, pass 21, fail 0
```

`pre-commit run --all-files` is clean before every commit, and `git status` is
clean after every commit. `trufflehog` fails structurally in a linked worktree
(git-mode scan, `.git` is a file); each commit was preceded by a filesystem
scan over exactly the paths being committed, all reporting
`verified_secrets: 0, unverified_secrets: 0`, and only then prefixed with
`SKIP=trufflehog`. `SKIP=` was never extended to another hook and
`--no-verify` was never used. Only one hook rewrite occurred (mdformat on the
PRD, in task 2, which is finding 1 itself) and it was folded into that task's
commit before committing, not amended after.

The `node_modules` symlink was removed from the worktree. Restore it with
`ln -s ../../node_modules .worktrees/pr-141/node_modules` if the gate needs
re-running.

## Push

Not pushed. Dry run is green and exercised the `pre-push` hook:

```text
To https://github.com/rakesh-vs/pi-claude-marketplace.git
   6bd79fea..9fc24ea9  pr-141 -> fix/nested-command-discovery
```

The operator runs:

```bash
env GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=lfs.locksverify GIT_CONFIG_VALUE_0=false \
  git -C .worktrees/pr-141 push https://github.com/rakesh-vs/pi-claude-marketplace.git \
  pr-141:fix/nested-command-discovery
```

## Observation, not fixed

`duplicateWarning` says "already produced by an earlier
`componentPaths.commands` entry", which is wrong when the two colliding
sources sit in the **same** entry -- exactly the D-141-01 collision the new
test pins. This is pre-existing: before PR #141 a flat `acme-foo.md` beside
`foo.md` in one directory produced the same inaccurate sentence. Out of scope
here, recorded for a later pass.

## Self-Check: PASSED

- `docs/prd/pi-claude-marketplace-prd.md` -- modified, CM-2 and Appendix B
  carry the rule.
- `.planning/PROJECT.md` -- D-141-01 row present.
- `tests/domain/name.test.ts`, `tests/bridges/commands/discover.test.ts` --
  modified, 5 new cases.
- `extensions/pi-claude-marketplace/bridges/commands/discover.ts` -- modified.
- `CHANGELOG.md` -- modified.
- All six commits present in `git log`: `69f7caa4`, `937ebd0b`, `b8d1970e`,
  `066e9004`, `e69e9823`, `9fc24ea9`.
- Working tree clean.

______________________________________________________________________

## Review fixes

The five-reviewer pass over `git diff main...HEAD` produced
`260821-eln-REVIEW.md`. Findings A1-A5, all of B, all of C and all of D were
closed in seven commits on `pr-141`.

| Commit     | Title                                              | Closes           |
| ---------- | -------------------------------------------------- | ---------------- |
| `35150656` | fix(commands): keep a command head the elision would empty | D-141-02, A4 main case |
| `c67cc5ba` | fix(commands): finish the tolerant command walk     | A2, A3, A4 remnant |
| `f4db2b0c` | fix(install): deliver the bridge discovery warnings | A1, D-19-01 amendment, `discover-names.ts` |
| `9142f8bc` | docs(commands): correct what the nested-command docs claim | A5, all of B     |
| `21837618` | test(commands): pin the parts of the walk nothing checked | all of C         |
| `22e4a578` | fix(commands): close the adjacent gaps around the walk | all of D         |
| `c7081318` | docs(changelog): rewrite the unreleased entries      | CHANGELOG        |

### Decisions taken during the fixes

- **D-141-02 is commands-only**, as decided. `generatedSkillName` and
  `generatedAgentName` keep their throw.
- **D-141-03 (new)**: a discovery warning is not a hygiene warning. The skills
  and commands bridges feed a standalone-visible channel; the agents bridge
  aggregates three kinds of warning onto one field that cannot be split at the
  install site, so its array joins the hygiene channel -- folded rather than
  dropped, but still orchestrated-only. Recorded in `.planning/PROJECT.md`.
- **`assertNoCommandCollisions` retired, not moved.** Moving it upstream of
  the dedup is where it would fire, and firing contradicts D-141-01, which
  locks first-wins-plus-warning as the commands collision policy. PRD RN-6
  amended to say so.
- **`nameCommandInDir` kept**, now throwing the typed `CommandNameError` with
  the reason on `Error.cause` instead of a bare `Error` that inlined the cause
  text and passed it twice.

### Left open, deliberately

- `assertNoSkillCollisions` has the same unreachable shape as the commands
  gate that was retired. `discoverPluginSkills` also returns Map values. Not
  measured by this review and not settled by a decision, so untouched.
- `orchestrators/plugin/update.ts` reads no `result.warnings` from any bridge,
  so every staging and discovery warning is dropped on the update path.
  `install.ts` and `reinstall.ts` both fold. Not in the review's findings.

### Gate

`npm run check` exit 0. 3623 unit tests (3622 pass, 1 platform skip),
21 integration tests, 0 failures.
