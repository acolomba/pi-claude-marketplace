---
id: 260821-eln
slug: land-pr-141-recursive-nested-command-dis
description: Correctness evaluation of PR #141 -- recursive nested command discovery
date: 2026-08-21
pr: 141
contributor: rakesh-vs
contributor_branch: fix/nested-command-discovery
local_branch: pr-141
worktree: .worktrees/pr-141
verdict: correct
---

# PR #141 Correctness Evaluation

External PR #141 (@rakesh-vs, "fix(commands): discover nested command files
recursively (CM-4)") makes `bridges/commands/discover.ts` walk each declared
`commands/` directory recursively, and teaches `domain/name.ts::generatedCommandName`
to accept a `/`-separated relative path, validate each segment, and join the
segments with `:`. It closes issue #140, filed by the same contributor.

**Verdict: correct.** The naming contract it implements matches Claude Code
exactly, the mechanism works on the Pi side, and the full gate is green. Six
findings, none blocking.

## The parity premise, measured

The PR and issue #140 both justify the colon-path convention by citing the
nested-**skills** passage in Claude Code's slash-commands doc (`apps/web/.claude/skills/deploy/SKILL.md`
-> `/apps/web:deploy`) plus the line that commands and skills "work the same
way". That citation does not support the claim: the `apps/web:` prefix is the
path to a nested `.claude/` root in a monorepo, applied only on a name clash --
not a subdirectory inside a `commands/` directory. The docs are worse than
merely silent on the real question:

- The "How a skill gets its command name" table gives, for a file under
  `.claude/commands/`, "File name without extension" -- no path segments.
- `plugins-reference` describes the plugin `commands` field as "Custom **flat**
  `.md` skill files or directories".

So the documentation, read literally, contradicts the PR. It is the
documentation that is wrong.

Measured against the real binary instead. A synthetic plugin was loaded into
Claude Code 2.1.228 with `--plugin-dir`, and the registered commands read off
the `slash_commands` field of the `system`/`init` message emitted by
`claude -p --output-format stream-json --verbose`:

| source under `commands/` | Claude Code 2.1.228 | PR #141 |
| ------------------------ | ------------------- | ------- |
| `deploy.md`              | `acme:deploy`       | `acme:deploy` |
| `build/web.md`           | `acme:build:web`    | `acme:build:web` |
| `build/web/prod.md`      | `acme:build:web:prod` | `acme:build:web:prod` |
| `mid/acme-mid.md`        | `acme:mid:acme-mid` | `acme:mid:acme-mid` |
| `mid/acme-leaf/go.md`    | `acme:mid:acme-leaf:go` | `acme:mid:acme-leaf:go` |
| `notes.txt`              | not registered      | not discovered |
| `.hidden/secret.md`      | `acme:.hidden:secret` | skipped (repo dotfile policy) |
| `acme-flat.md`           | `acme:acme-flat`    | `acme:flat` (pre-existing CM-2 elision) |
| `acme-tools/lint.md`     | `acme:acme-tools:lint` | `acme:tools:lint` (elision, D-141-01) |

Recursion and colon-joining are exact parity to arbitrary depth. The two
divergences are both elision, and elision is a pre-existing, deliberate CM-2
rule: Claude Code performs no elision at all, so `acme-flat.md` already
diverged before this PR.

The mirror case was checked as well: a nested plugin **skill**
(`skills/grp/deep/SKILL.md`) is **not** registered by Claude Code -- only a
flat `skills/plain/SKILL.md` is. Scoping this fix to commands and leaving the
skills bridge alone is therefore correct, not an oversight. No follow-up issue
is warranted for skills.

## The Pi side works

`@earendil-works/pi-coding-agent` derives a prompt template's name as
`basename(filePath).replace(/\.md$/, "")` (`dist/core/prompt-templates.js:85`)
and matches an invocation with `/^\/([^\s]+)(?:\s+([\s\S]*))?$/`
(`expandPromptTemplate`). A staged `acme:build:web.md` therefore registers as
`acme:build:web` and `/acme:build:web` resolves against it. Multiple colons are
not special to either the loader or the matcher, so no Pi-side change is needed.

## Gate

`npm run check` is green on the PR head in `.worktrees/pr-141` (typecheck,
lint, fallow, format:check, 3606 unit, 21 integration, 0 fail). The chain is
`&&`-joined and the integration suite is its last link, so reaching a green
integration run proves every earlier stage passed.

## Behavior confirmed against the PR's own code

Run directly against `discoverPluginCommands` from the PR branch:

- A symlinked subdirectory under `commands/` is **not** followed. A tree at
  `commands/linked -> ../real` containing `outside.md` yields no
  `acme:linked:outside` entry.
- Seven-level nesting resolves to `acme:a:b:c:d:e:f:deep`.
- A directory whose own name ends in `.md` is traversed as an ordinary path
  segment (`commands/dir.md/inside.md` -> `acme:dir.md:inside`).

The PR gates directory recursion on `Dirent.isSymbolicLink()` alone, while the
pre-existing file path additionally `lstat`s inside `isPlainMarkdownFile`.
Node resolves `UV_DIRENT_UNKNOWN` through `lstat` before constructing the
`Dirent`, so `isSymbolicLink()` is authoritative on every filesystem and the
asymmetry is not exploitable. Containment needs no `assertPathInside` either:
`readdir` never yields `.` or `..`, so absent a followed symlink the walk
cannot leave the `commands/` root.

## Findings

| # | Finding | Severity | Disposition |
| - | ------- | -------- | ----------- |
| 1 | `docs/prd/pi-claude-marketplace-prd.md` is not mdformat-clean. The widened CM-4 cell left the table's column padding stale; `pre-commit run --all-files` rewrites the file, so the `lint.yml` pre-commit job fails on this PR as submitted. | blocking-CI | fix |
| 2 | Elision is extended to the first *directory* segment, widening the CM-2 divergence from Claude Code and creating a collision class between `acme-tools/lint.md` and `tools/lint.md`. | design | **keep** (D-141-01), document + test |
| 3 | An unreadable subdirectory under `commands/` (mode 000) now aborts the whole install with a raw `EACCES ... scandir`. Before the PR the directory was never opened. `readDirEntriesTolerant` tolerates only ENOENT/ENOTDIR. | robustness | decide + record |
| 4 | No CHANGELOG entry. | convention | fix (`[Unreleased]`) |
| 5 | Branch forks from `8992d850`, one commit behind `main` (`fb4216df`). | hygiene | merge `main` in |
| 6 | The safe-name error label lost its `commandsDir` context: was `command source name in <dir>`, now `command path segment in "<source>"`. | diagnostics | fix |

## Decisions taken

- **D-141-01 -- elision applies to the first path segment.** Keep the PR's
  behavior as submitted. A directory named `acme-tools` inside plugin `acme` is
  the same stutter CM-2 exists to remove, and the rule stays a single sentence:
  the `<plugin>-` prefix is elided from the head of the source, whether that
  head is a file stem or a directory name. The resulting divergence from Claude
  Code is the same kind CM-2 already accepted for flat files.
- **No version bump.** Record the change under `[Unreleased]` in CHANGELOG.md
  and leave `package.json`, `package-lock.json`, `EXTENSION_VERSION`, and
  `sonar.projectVersion` at 0.17.0. This matches how PR #138 landed.
