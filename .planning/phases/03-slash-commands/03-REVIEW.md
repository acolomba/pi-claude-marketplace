---
phase: 03-slash-commands
reviewed: 2026-11-01T22:09:43Z
depth: standard
iteration: 2
files_reviewed: 2
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/commands/stage.ts
  - extensions/pi-claude-marketplace/bridges/commands/discover.ts
findings:
  critical: 0
  warning: 0
  info: 6
  total: 6
status: clean
---

# Phase 3: Code Review Report (iteration 2)

**Reviewed:** 2026-11-01T22:09:43Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** clean

## Narrative Findings (AI reviewer)

## Summary

This pass re-reviews the two files that the iteration-1 fixes changed,
`git diff 28224a6 HEAD` (commits 00714ec and 0822dc3), and the functions
those hunks touch: `recordCommittedCommands`, the new
`removeUnrecordedCommands`, `commitPreparedCommands`, `repeatsLoadedFile`,
`admitCommand`, and `discoverPluginCommands`. I also traced the two callers of
`commitPreparedCommands` (`install-outcome.ts:1289` and its undo,
`update-swap.ts:1244-1262`), the ledger's update contract
(`project-ledger.ts:18-19`: a failed update leaves the ledger as it was), and
`unstage.ts`'s ENOENT-tolerant `unlinkIfPresent`.

**WR-01 is resolved.** When `recordCommittedCommands` throws, the commit now
unlinks every `_renamePairs[].to`. ENOENT counts as success, and any other
error becomes a leak appended after the staging-cleanup leak. The error keeps
its original identity when there is no leak (`appendLeaks` with only
`undefined` entries). So a throw again means "no new command is on disk":

- Update runner: `failedPhases.has("commands")` keeps the old
  `resources.prompts`. No new unrecorded file is left for Pi to list after
  `/reload`.
- Install ledger: the failing phase's undo runs `unstagePluginCommands` over
  `stagedCommandNames`. Its unlinks are ENOENT-tolerant, so files that are
  already gone do no harm, and its own ledger failure is downgraded to a
  warning (WR-04).
- User scope: `projectCommandChange` returns `undefined`, so the branch
  never runs.

What remains is not new. The previous-name files were unlinked before the
renames, so after a failed update `state.json` (and the unchanged ledger)
still list old names with no files behind them. A rename failure in this
same function has always left that state. Every later path reads it
ENOENT-tolerantly (re-stage unlink, uninstall, unstage), so a retry
converges (NFR-3).

**WR-02 is resolved.** `repeatsLoadedFile` no longer writes. `admitCommand`
records `byFile` only after the command wins `byGenerated`, and only for
`kind: "file"`. Each source file can still be admitted at most once: an
admitted file is in `byFile`, so every later visit returns early. The
`discovered` output therefore still has unique `commandFile` values. The
false "already loaded as command source" warning can no longer name a
command that never loaded. Map entries that name a file declared directly
(D-CF3-05), or a file a folder walk admitted, still get the D-CF3-03
warning.

The fixes add no new Critical or Warning finding. One new Info item (IN-06)
concerns a new unit test that only works on Linux. IN-01..IN-05 are carried
forward unchanged from iteration 1. They were outside the fix scope and were
not re-reviewed.

## Info

### IN-01: A list-form `argument-hint` is dropped with no warning (carried forward, out of scope)

**File:** `extensions/pi-claude-marketplace/bridges/commands/staged-command.ts:178-195`, `:217-225`

**Issue:** `argument-hint: [message]` is the form that Claude Code's own
slash-command documentation shows. YAML parses it as the list
`["message"]`. The rebuild writes it out as a JSON array. Pi's
`loadTemplateFromFile` keeps `argument-hint` only when
`typeof === "string"`, so the hint vanishes from the TUI menu. No
dropped-field line reports it. Nobody probed whether Claude Code 2.1.316
shows `[message]` for this form (03-UPSTREAM-EVIDENCE Q5 used only
`<env> <region>`).

**Fix:** Probe it upstream with the `claude-code-compat-research` skill. If
upstream shows the hint, write a list of strings back as its YAML flow text
(`[message]`) in `stagedFrontmatter`. Otherwise, add it to the D-CF3-09
dropped-fields line.

### IN-02: The reinstall hint copies plugin and marketplace names from the project's `state.json` without escaping them (carried forward, out of scope)

**File:** `extensions/pi-claude-marketplace/orchestrators/command-invocation.ts:264-279`, `:303-306`

**Issue:** `projectReinstallCommand` reads `<cwd>/.pi/pi-claude-marketplace/state.json`.
That file can come from the repository, which is the threat that D-CF3-07
guards against. The function puts the record keys verbatim into the refusal
text: `/claude:plugin reinstall ${plugin}@${marketplace} --scope project`.
`PLUGIN_INSTALL_RECORD_SCHEMA` keys are `Type.String()` with no name check,
so control characters, newlines, or a crafted hint reach the
notification. Skills carry the same pattern (D-CF2-13,
`skill-invocation.ts:230-249`), which is why this is Info.

**Fix:** Fall back to `ANY_PROJECT_REINSTALL` unless both names pass
`assertSafeName`. Alternatively, run the message through the escaping that
`showHiddenCharacters` in `discover.ts` already uses.

### IN-03: A map entry's directory walk reports duplicates against the plugin root instead of the walked directory (carried forward, out of scope)

**File:** `extensions/pi-claude-marketplace/bridges/commands/discover.ts:568-571`, `:755-757`

**Issue:** A directory `source` walks with `base = sourceFile`, but
`admitCommand` receives `pluginRoot` as `where`. A duplicate inside that
walk therefore reads `command source "x" in "<pluginRoot>"`, while `x` is
relative to the walked directory. (The line numbers have moved since
iteration 1. The code is the same.)

**Fix:** Have `discoverMapSource` return the walked directory and pass it
as `where` for the walked commands.

### IN-04: The terminal-menu parser assumes rows padded to a fixed width in a raw stream with the control codes removed (carried forward, out of scope)

**File:** `features/step_definitions/slash-command/frontmatter.steps.ts:45-62`

**Issue:** `menuRows` slices `removeTerminalControls(output)` into
120-character chunks, starting at the last `→ ` marker. The text is the
raw output stream, not a screen buffer, so the slicing depends on two
things:

- Pi redraws every menu row in full, padded, with no newline.
- No row has a wide or multi-unit character.

A partial redraw, or a description with a CJK character or an emoji, would
shift every later row. The test would then fail with no product change.
P3-DC-13.3 records the assumption, but the step has no guard for it.

**Fix:** Before parsing, assert that the slice from the marker has a length
that is a multiple of 120, and that every row in it matches. Better, read
the rows from a terminal emulator snapshot if `pi-tui.ts` gains one.

### IN-05: A staged project command whose path does not compare equal falls back to Pi's own expansion and skips the provenance check (carried forward, out of scope)

**File:** `extensions/pi-claude-marketplace/orchestrators/command-invocation.ts:157-167`

**Issue:** `locateStagedCommand` compares `path.resolve(sourceInfo.path)`
byte for byte with `path.resolve(cwd, ".pi", ..., name + ".md")`. Any
spelling difference returns `not-staged`, and Pi then sends the file's
body unchecked. Examples are a symlinked or differently cased cwd on a
case-insensitive filesystem, or Pi resolving prompt paths through
`realpath`. Pi's expansion runs no `!` commands, so the exposure is only
the prompt text. Even so, the check fails open.

**Fix:** Compare `realpath` results, falling back to `path.resolve`, or
match on the staged prompts directory with `path.relative`. Do not treat a
file under a staged prompts directory that fails the comparison as
`not-staged`.

### IN-06: The new WR-01 "cannot remove" unit case pins a Linux-only errno message

**File:** `test/bridges/commands/stage.test.ts:1291-1321` (added in 00714ec)

**Issue:** The case puts a directory in a renamed target's place and
asserts the exact leak text
`EISDIR: illegal operation on a directory, unlink '<path>'`. `unlink(2)` on
a directory returns EISDIR on Linux, but EPERM on macOS. On a macOS
checkout the production code still does the right thing (the error is not
ENOENT, so it becomes a leak), but this assertion fails. CI runs only on
`ubuntu-latest`, so the gate stays green. Other tests in the repository
already allow for this difference (`remove.test.ts:1342` matches
`/EISDIR|directory/i`). This is Info because it affects only local runs
on another OS. The file's `acme:greet.md` target names already rule out
Windows.

**Fix:** Assert the message prefix and the cause, and match the errno part
loosely, for example:

```ts
assert.match(
  error.message,
  /^the project ledger cannot be written \(additionally: failed to remove unrecorded command .*acme:greet\.md: (EISDIR|EPERM)\b/,
);
assert.strictEqual(error.cause, ledgerError);
```

---

_Reviewed: 2026-11-01T22:09:43Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
