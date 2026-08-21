---
id: 260821-eln
slug: land-pr-141-recursive-nested-command-dis
description: Consolidated pr-review-toolkit findings for PR #141 and the decisions taken
date: 2026-08-21
pr: 141
scope: full -- introduced defects, false docs, test gaps, and the adjacent tier
---

# PR #141 Review Findings

Five reviewers ran over `git diff main...HEAD`: code quality, test coverage,
silent failures, comment accuracy, and type design. Every critical claim below
was re-verified directly before being accepted.

The naming mechanism is sound and parity with Claude Code 2.1.228 holds. Both
complexity gates measure well under their limits (`walkCommandsDir` is 6
cyclomatic / 9 cognitive / 48 lines against 20 / 15 / 60). mdformat and
markdownlint pass. The comment policy is clean. `sourceName` reaches only
message builders, never a path component, so both type reviewers concluded a
plain `string` is correct and no brand is warranted.

The defects are concentrated in the follow-up commits, not the contributor's.

## A -- Introduced defects

| ID | Finding | How it was verified |
| -- | ------- | ------------------- |
| A1 | The unreadable-subdirectory warning has NO delivery path. `install.ts` reads `result.warnings` only at line 1107, the mcp phase. The commands phase sets `commandsPrep` and folds `degraded`, but never reads `prep.result.warnings`. | Grepped every `bridgeWarnings.push` and `result.warnings` read in `install.ts`. |
| A2 | The EACCES fix is half done. `readWalkEntries` guards the `readdir`; it does not guard the per-entry `lstat` inside `isPlainMarkdownFile`. A mode-0444 directory (readable, not searchable) lets `readdir` succeed and then aborts the install. | Ran it: `THREW: EACCES: permission denied, lstat '.../rx/b.md'`. |
| A3 | The subdirectory catch is unfiltered. It swallows EIO, EMFILE/ENFILE, and an ENOENT/ENOTDIR race identically to EACCES, contradicting `readDirEntriesTolerant`'s documented "every other errno propagates" discipline that the same function honors on its `dir === base` branch. | Read the catch; no errno discrimination. |
| A4 | A badly-named subdirectory aborts the whole install. `commands/acme-/lint.md` beside `commands/good.md` installs nothing, where `main` installed `acme:good`. Sits directly against A2's softening. | Reachable by construction through `nameCommandInDir`. |
| A5 | `duplicateWarning` blames "an earlier `componentPaths.commands` entry" for collisions that now occur WITHIN a single entry. | Ran the D-141-01 collision fixture with one entry; message confirmed. |

## B -- False statements the PR ships

- `discover.ts:11-13` still rests the colon convention on the refuted
  nested-skills citation. The evaluation measured that nested plugin skills are
  **not registered at all** by Claude Code, so the parenthetical cites the one
  component kind that demonstrably does not work the same way.
- `discover.ts:19` claims within-directory RN-6 collisions are hard errors via
  `assertNoCommandCollisions`. Provably false, and the PR's own new test proves
  it false.
- `discover.ts:5` promises a "sorted" array. The walk returns DFS pre-order,
  name-sorted within each directory. Traversal order IS the first-wins
  tiebreak, so a reader who trusts "sorted" mispredicts which side wins.
- `discover.ts:152` comments on refusing symlinked `.md` entries, but symlink
  rejection moved eleven lines earlier; nothing symlinked reaches it.
- `shared/fs-utils.ts:294` claims `readdir`'s `withFileTypes` "reports a
  symlink's TARGET type in some conditions". This is the inaccurate half of the
  contradiction two reviewers flagged: a symlink-to-directory reports
  `isDirectory() === false` and `isSymbolicLink() === true` under BOTH the
  `d_type` path and the `UV_DIRENT_UNKNOWN` -> `lstat` fallback. Recursion is
  gated on `isDirectory()`, so it cannot follow a symlink either way. No
  containment hole exists; the comment is what is wrong.
- PRD: CM-1's `<plugin>:<command>` staging path and Appendix B's "Generated
  form" cell were not widened alongside CM-2 and CM-4. CM-2 cites D-141-01 but
  never states that upstream produces `acme:acme-tools:lint`. CM-4 claims
  parity in the same row that mandates the dotfile divergence, which is
  undocumented anywhere.
- `CHANGELOG.md` bullet 3 says an error "again" names its directory. That is
  only true inside this PR's own commit sequence; relative to 0.17.0 the
  directory was always named. It advertises a fix for a bug that never shipped.
- "CM-4 (revised)" is a temporal marker that rots once only one CM-4 exists.

## C -- Test gaps

Mutation testing planted 10 mutations; 7 were killed, 3 survived.

- **M1 (elide every segment) kills only ONE assertion.** Both tests named for
  D-141-01 pass under all-segment elision, because `acme-tools/lint` and
  `tools/lint` land on the same name either way. Only
  `build/acme-web -> acme:build:acme-web` separates the two rules.
- **M6 (make the top-level directory tolerant too) kills nothing.** Half of the
  EACCES change's contract is unpinned. The mutation is not harmless: a missing
  `commands/` would emit `command subdirectory "" ... ENOENT` for every plugin
  declaring no commands.
- **M10 (drop the errno from the warning) kills nothing.**
- Nothing at any level asserts a discover warning survives past
  `discoverPluginCommands`. That is why A1 shipped.
- New collision class untested: flat `build:web.md` beside nested
  `build/web.md`. Both generate `acme:build:web`; the nested file wins and the
  flat one is dropped.
- No round-trip or integration coverage for a nested name anywhere.
- The mode-000 test's `finally` runs `chmod` before `rm`; if the first `mkdir`
  in the `try` fails, the `chmod` throws ENOENT, masks the real error, and
  leaks the temp directory. `chmod` is also imported dynamically while the same
  module is imported statically at the top of the file.

## D -- Adjacent, pre-existing

- `assertNoCommandCollisions` cannot fire. `discoverPluginCommands` returns
  `[...seenByGenerated.values()]` from a `Map` keyed on `generatedName`, so its
  input is duplicate-free by construction. Its only two tests hand-build the
  colliding array and pass it directly -- green while the production path never
  reaches the throw.
- `install.ts` drops `result.warnings` for skills and agents too, not just
  commands. The D-07 duplicate warnings for those bridges have been dark since
  they were written.
- Symlinked and dotfile SUBDIRECTORIES are skipped silently. A directory skip
  discards an unbounded number of artifacts where a file skip discards one.
- `nameCommandInDir` throws an untyped `Error` and inlines `errorMessage(err)`
  while also passing `{ cause }`, so `causeChainTrailer` renders the inner text
  twice.
- ENAMETOOLONG is far more reachable: the generated name is now bounded by a
  whole relative path rather than one filename.
- `discover-names.ts` discards the discovery warnings entirely, running the
  walk twice per install.
- Overlapping `componentPaths.commands` entries can double-install one file
  under two different generated names, with no warning.

## Decisions taken

- **D-141-02 -- an elision that would empty the head does not fire.**
  `generatedCommandName` keeps the head verbatim instead of throwing, so
  `commands/acme-.md` becomes `acme:acme-` and `commands/acme-/lint.md` becomes
  `acme:acme-:lint`. Measured: Claude Code 2.1.228 registers exactly those.
  This retires A4's main case, and also retires a PRE-EXISTING fatal -- a flat
  `commands/acme-.md` fails to install on `main` today.

  **Commands only.** Pi's `core/skills.js::validateName` rejects a name that
  ends in a hyphen or contains consecutive hyphens, so `generatedSkillName`
  without elision would yield `acme-acme-` and merely move the failure
  downstream to a worse message. `generatedSkillName` and `generatedAgentName`
  keep their throw; Pi prompt names are unvalidated, so commands do not need it.

- **A4 remnant -- skip and warn.** A directory whose name fails RN-2 for a
  non-elision reason (ASCII control character, literal backslash) is skipped
  with a warning rather than aborting the install. Consistent with the
  unreadable-directory decision: no tree that installs on `main` stops
  installing.

- **D-19-01 amended, narrowly.** Discovery-truncation warnings surface in
  standalone `/claude:plugin install`, not only on orchestrated paths. A
  truncation means the installed artifact set does not match what the author
  shipped, and the install row's prompt count gives the user no baseline to
  detect it. Hygiene warnings (deferred mkdir, deferred cache refresh) stay
  suppressed in standalone mode as before.

- **Scope -- full, including the adjacent tier.** Accepted consequence:
  unmuting the skills and agents warning drop surfaces D-07 duplicate-name
  messages that have been dark since they were written. Nothing breaks, but
  users may see messages on their next `/reload` that they have not seen before.

- **No brand for `sourceName`, no `parse-don't-validate` rewrite of
  `generatedCommandName`.** Two reviewers costed it independently and both
  concluded against. `sourceName` has two consumers, both string interpolation
  into a message; it never reaches `path.join`, `assertPathInside`, or
  `state.json`. `domain/name.ts` has zero imports and is the leaf-est module in
  the extension; widening its public API to prevent a mistake with one possible
  call site is not warranted. Record the reasoning instead so the question does
  not recur.
