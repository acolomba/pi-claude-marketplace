---
phase: 03-slash-commands
reviewed: 2026-11-01T21:54:07Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/commands/command-record.ts
  - extensions/pi-claude-marketplace/bridges/commands/discover.ts
  - extensions/pi-claude-marketplace/bridges/commands/project-ledger.ts
  - extensions/pi-claude-marketplace/bridges/commands/stage.ts
  - extensions/pi-claude-marketplace/bridges/commands/staged-command.ts
  - extensions/pi-claude-marketplace/bridges/commands/types.ts
  - extensions/pi-claude-marketplace/bridges/commands/unstage.ts
  - extensions/pi-claude-marketplace/domain/component-paths.ts
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/edge/command-invocation.ts
  - extensions/pi-claude-marketplace/orchestrators/command-invocation.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - features/lib/slash-command-files.ts
  - features/step_definitions/slash-command/frontmatter.steps.ts
  - features/step_definitions/slash-command/invocation.steps.ts
  - features/step_definitions/slash-command/listing.steps.ts
  - features/step_definitions/slash-command/project-provenance.steps.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-11-01T21:54:07Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I read the new commands-bridge modules in full (`command-record.ts`,
`project-ledger.ts`, `staged-command.ts`, `discover.ts`, `stage.ts`,
`unstage.ts`, `types.ts`) and both invocation modules. For the large shared
files, I read the hunks in `git diff origin/claude/quirky-planck-hhm592 HEAD`
and the functions they touch. I also traced the callers: Pi's
`parseFrontmatter` and `loadTemplateFromFile` (installed 1.4.0), Phase 2's
`project-installs.ts` ledger (forget, then remember, keyed by name), the
update runner's `failedPhases` gating, and `cascadeUnstagePlugin`.

The core paths hold up when traced:

- The JSON-line frontmatter rebuild reads back the same through Pi's parser,
  including for sources with no fence, an empty fence, a source of only
  `---`, CRLF, and a closing fence followed by text.
- The provenance digest is taken over a single read of the file, so the
  bytes that are hashed are the bytes that are filled in.
- The record key cannot be planted, because the author's value is replaced.
- The trust check runs before any read.
- Every write and unstage call site passes the ledger.

I found two warnings. The first is a new failure mode in the update runner:
when the commit has already landed and the ledger write then fails, the
state record no longer matches the files on disk. The second is a
first-wins bookkeeping bug: discovery drops a map-declared command and then
gives a false reason for dropping it. Choices that DUBIOUS-CHOICES records
(P3-DC-09..19) are not reported here as defects. That includes the E8
re-expansion, the "skill ledger" wording, `allowedTools` accepting a
string, and `info` not listing map entries.

## Warnings

### WR-01: A ledger write that fails after the commit has landed leaves an update's record out of step with the files on disk

**File:** `extensions/pi-claude-marketplace/bridges/commands/stage.ts:344-347`, consumed at `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:1244-1262` and `:825-827`

**Issue:** `commitPreparedCommands` now does three things in order:

1. It unlinks the previous target files (`:291-308`).
2. It renames every new file into `resources/prompts/` (`:320-324`).
3. It calls `recordCommittedCommands`, and that call can throw (`:345`).

Step 3 throws whenever the project ledger write fails. One cause is
`ProjectSkillLedgerError` "unknown-content" (WR-02). That happens when the
ledger was written by another version, or when the file is corrupt, or
when `<agentDir>` cannot be written. The comment says "the caller's undo
removes commands that could never run". That holds for the install ledger,
because `install-outcome.ts:1280` sets `c.stagedCommandNames` before the
commit and the failing phase's undo unstages the files.

The update runner has no undo. `commitUpdatePhase3a` catches the throw and
pushes a `commands` failure. Then `applyPerBridgeResources` skips
`sRecord.resources.prompts = ...` because `failedPhases.has("commands")`.
After that:

- `state.json` still lists the old command names, but those files are
  already unlinked.
- The new files exist, but no record lists them.
- Pi lists the new files after `/reload`.
- `uninstall` and `disable` unlink only the recorded old names, so
  every new name that the old version did not have stays on disk with no
  record.

Before this phase, a commands commit that threw had rolled its renames
back, so "commit threw" meant "nothing new committed". The ledger write
breaks that contract for project scope.

**Fix:** Keep the contract "throws means the renames are rolled back". The
simplest way is to undo the renames inside `commitPreparedCommands` when the
ledger write fails:

```ts
const leak = await cleanupStaging(ops, prepared.stagingRoot, "commands staging directory");
try {
  await recordCommittedCommands(ledger, prepared);
} catch (err) {
  // The renamed files cannot be proven; remove them so a caller without an
  // undo (the update runner) never keeps unrecorded prompts.
  const removalLeaks = await Promise.all(
    prepared._renamePairs.map(async ({ to }) =>
      unlink(to).then(
        () => undefined,
        (e: unknown) => `failed to remove ${to}: ${errorMessage(e)}`,
      ),
    ),
  );
  throw appendLeaks(err, [...removalLeaks.filter((l) => l !== undefined), leak]);
}
return leak;
```

Another option is to keep the throw and have `update-swap.ts` treat a
ledger failure as a committed phase that carries a warning: write
`resources.prompts` and surface the ledger message. The project commands
then refuse at invocation until the user reinstalls.

### WR-02: A file that loses a name collision still claims its path, so a later map key that names it is dropped with a false reason

**File:** `extensions/pi-claude-marketplace/bridges/commands/discover.ts:649-708`

**Issue:** `admitCommand` calls `repeatsLoadedFile` first. That call writes
`state.byFile.set(command.commandFile, command)` (`:661`) before the
generated-name check at `:695-708`. A file that then loses the D-07
first-wins name check is never admitted, but it stays in `byFile` as if it
had loaded.

Here is a case that installs today. The plugin `demo` has no `plugin.json`
`commands`, so `commands/` is read. That folder holds `demo-lint.md`, which
CM-2 elides to `demo:lint`, and `lint.md`, which also becomes `demo:lint`
and loses. The marketplace entry declares
`"commands": {"check": {"source": "commands/lint.md"}}`, which adds to the
folder under D-CF3-04. The map entry `check` then hits `byFile` and is
dropped with the warning
`command map entry "check" names "commands/lint.md", already loaded as command source "lint"`.
No command `lint` was loaded, and `demo:check` never exists. The user
loses a command and gets a misleading reason.

The same early registration also drops, silently, an overlapping-directory
copy of a file that lost its name at its first depth. The old code had that
behavior too, but the new map warning turns it into a false statement.

**Fix:** Record the file only when the command is admitted:

```ts
function admitCommand(state, command, where, mapKey): void {
  if (repeatsLoadedFile(state, command, where, mapKey)) {   // read-only check
    return;
  }
  const winner = state.byGenerated.get(command.generatedName);
  if (winner === undefined) {
    state.byGenerated.set(command.generatedName, command);
    if (command.kind === "file") {
      state.byFile.set(command.commandFile, command);        // moved here
    }
    return;
  }
  state.warnings.push(/* ...unchanged... */);
}
```

Then remove the `state.byFile.set` call from `repeatsLoadedFile`. Add a unit
case for the elided-collision plus entry-map shape.

## Info

### IN-01: A list-form `argument-hint` is dropped with no warning

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

### IN-02: The reinstall hint copies plugin and marketplace names from the project's `state.json` without escaping them

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

### IN-03: A map entry's directory walk reports duplicates against the plugin root instead of the walked directory

**File:** `extensions/pi-claude-marketplace/bridges/commands/discover.ts:750-752`, `:701-703`

**Issue:** A directory `source` walks with `base = sourceFile`, but
`admitCommand` receives `pluginRoot` as `where`. A duplicate inside that
walk therefore reads `command source "x" in "<pluginRoot>"`, while `x` is
relative to the walked directory.

**Fix:** Have `discoverMapSource` return the walked directory and pass it
as `where` for the walked commands.

### IN-04: The terminal-menu parser assumes rows padded to a fixed width in a raw stream with the control codes removed

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

### IN-05: A staged project command whose path does not compare equal falls back to Pi's own expansion and skips the provenance check

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

---

_Reviewed: 2026-11-01T21:54:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
