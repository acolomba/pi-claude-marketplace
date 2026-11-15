# Spike S8: `@file` references and plugin `bin` for hooks

**Date:** 2026-11-15
**Method:** `.agents/skills/claude-code-compat-research`, evidence levels 1 and 2 only. No sandboxed
probe ran: a probe needs a live Claude Code session, and this run must not start one that could
read real credentials or the real `~/.claude`. Each fact a probe alone can settle is marked
**unverified**.

**Sources:**

- `BIN`: the Claude Code 2.1.323 binary,
  `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude` (346 MB). Printable runs
  of 40 or more characters were extracted to a scratch file and searched. Functions are named by
  their minified 2.1.323 names, which differ from the 2.1.322 names in
  `docs/research/parity-gaps/skills-commands.md` (`G3r`/`mGn`/`q3r` there).
- `DOCS`: `https://code.claude.com/docs/en/plugins-reference.md` and
  `https://code.claude.com/docs/en/skills.md`, fetched 2026-11-15.
- `PI`: `node_modules/@earendil-works/pi-tui/dist/autocomplete.js` (1.5.0, the installed dev copy).

## Q1. Which `@` references does a plugin skill or command attach, and from what text?

**Claude Code 2.1.323:** when a prompt command runs (a plugin skill or command), the invocation
function renders the content with `getPromptForCommand(args, ctx)` and then runs the attachment
pass over the **rendered text**: `SSe(re.filter(text).map(text).join(" "), ...)`. The pass is
skipped only when `zSt(e)` is true (synced claude.ai skills, MCP skills, memory stores, attached
folders) or for a skill preload or a model-scheduled run. A plugin command has `loadedFrom`
`"plugin"` or undefined, so `zSt` is false and the pass runs.

The plugin `getPromptForCommand` builds the rendered text in this order:

1. `Base directory for this skill: <dir>` (skills only), then the body.
2. `AXe(body, args, true, argNames, ...)`: argument substitution (`$name`, `$ARGUMENTS[N]`, `$N`,
   `$ARGUMENTS`, else an appended `ARGUMENTS: <args>` line). Each argument value is passed through
   `LH`, which escapes `!` so that an argument cannot inject a shell command. Nothing escapes `@`.
3. `pNe(...)`: runs each `` !`cmd` `` and ```` ```! ```` block and replaces it inline with its
   output (`y=y.replace(Ae,()=>Dt)`).

So the attachment pass sees argument text and `!` output. **An `@path` in an argument or in `!`
output is attached by Claude Code.** Confidence: high for the order and the scanned text (read in
code); medium that nothing later removes such a mention (no probe ran).

The typed line itself is not scanned when it starts with `/`
(`nt=ie!=="all"&&(Me||!ne?.startsWith("/"))`); the arguments reach the pass only through the
rendered content.

**Mention syntax** (`z_s`, `R3n`, `sls`):

- `@"path with spaces"`, when `@` is at the start or after whitespace or one of `。、？！`; a value
  ending ` (agent)` is an agent mention, not a file.
- An unquoted `@token`: the text is split on whitespace; the `@` must start the token or follow one
  of `。、？！`; trailing non-word characters are cut. `@agent-<name>` is an agent mention.
- `#L10` or `#L10-20` after the path is a line range (`^([^#]+)(?:#L(\d+)(?:-(\d+))?)?(?:#[^#]*)?$`).
- `qH` masks only the link form `@[label](claude-ref:...)` and Google Docs links before the scan.

**Fenced code and code spans:** not skipped. The tokenizer splits on whitespace and has no
Markdown awareness. Confidence: high (read in code). The "markdown walk" that skips code is the
`CLAUDE.md` `@import` reader, a different feature.

## Q2. What text is attached?

**Claude Code 2.1.323:** an attachment of type `file`, rendered to the model as two meta user
messages: `Called the Read tool with the following input: {"file_path":"<abs>"}` and the Read
tool's result for the file (line-numbered, `cat -n` form). A file over 2,000 lines is cut to the
first 2,000 lines with the note `Note: The file <name> was too large and has been truncated to the
first 2000 lines. ...`. An image, notebook, or PDF gets its own form. Confidence: high.

**Pi:** an `input` transform returns text only; Pi's own form for an attached file is
`<file name="<abs>">\n<content>\n</file>` (`PI/dist/cli/file-processor.js:60`, read in the
skills report). Parity of the wire form is not available.

## Q3. Limits, permissions, symbolic links, directories, missing files

- **Size:** a file larger than `maxSizeBytes` = 262,144 bytes (`hKt`, `gB().defaultFileReadingLimits`)
  is not read; the model gets `The user @-mentioned <name> ... not read: too large`. The Read token
  cap is 25,000 (`rVs`), overridable by `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS`. Confidence: high.
- **Permissions:** each path passes `mvr(path, ctx, "person")`, which applies the Read deny rules
  (`pq` -> `CBt(path, ctx, "read")`) and blocks UNC network paths. A denied path is dropped
  silently. Confidence: high.
- **Hooks:** the read goes through the mod hook `prompt.mention` (`readThroughMention`), not
  through a `PreToolUse` hook on `Read`. Confidence: medium (the hook chain `P0a` was not traced).
- **Symbolic links:** the Read machinery follows a link; no separate check was found. **Unverified**
  (inferred from the Read path; no probe).
- **Directories:** a directory mention is attached as a synthetic Bash call
  `ls <path>` with the listing as stdout (`xgo.directory`). Confidence: high.
- **Missing file:** the read returns nothing and the mention stays as text. Confidence: medium.

## Q4. Does the model's Skill-tool path attach?

**Unverified.** The same invocation function serves the Skill tool, and its flags (`p`
model-scheduled, `R` preload, `D`) can skip the pass; the caller that sets them for the Skill tool
was not traced.

## Q5. Do hooks get the plugin `bin` on `PATH`?

**Claude Code 2.1.323: no.** `getEnabledPluginBinPaths` (`$ys`) has two consumers: the Bash tool's
shell configuration (`kos` -> `kVn(..., {pluginBinPaths})`, the shell snapshot) and the PowerShell
tool spawn (`powerShellPluginBinPaths`). The hook runner builds the child environment from the
inherited process environment plus `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`,
`CLAUDE_PLUGIN_DATA`, `CLAUDE_PLUGIN_OPTION_<KEY>`, `COLUMNS`/`LINES`, and `CLAUDE_ENV_FILE`, and
adds no plugin `bin`. MCP stdio servers get `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, and
`CLAUDE_PROJECT_DIR` only. Confidence: high (read in code), corroborated by DOCS
plugins-reference: "Files here are on the Bash tool's `PATH` while the plugin is enabled".

## Side facts (outside this phase's gate)

- DOCS plugins-reference: "A plugin with `SKILL.md` at its root, no `skills/`, and no `skills` key
  loads as a single skill" (decision 26, SKILL-06).
- The other S8 questions of the PRD (a `blocked` MCP tool, `paths` on a plugin skill, the
  command-skill clash in 2.1.322) were not studied in this run.

## What this changes

| Item | Requirement or ROADMAP text | Upstream 2.1.323 | Effect |
| --- | --- | --- | --- |
| `@path` from an argument | Not attached (PG-SKILL-01, criterion 1) | Attached, subject to Read deny rules | Divergence; needs a recorded license (D-PG11-02) |
| `@path` from `!` output | Not attached (PG-SKILL-01) | Attached | Same divergence (D-PG11-02) |
| `@path` in fenced code or a code span | Not attached (criterion 2) | Attached | Divergence with no Pi gap behind it (D-PG11-03) |
| Directory reference | Requirement names "regular text file" | `ls` listing attached | Not attached; recorded (D-PG11-06) |
| Hooks and plugin `bin` | `docs/env-vars.md` says Claude Code adds it for hooks and MCP | Bash and PowerShell tools only | The doc row is corrected (PG-DOC-02, D-PG11-10) |
