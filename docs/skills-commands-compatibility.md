# Skill and command compatibility

Feature-by-feature comparison of how Claude Code runs a plugin's skills and commands against how the Pi-Claude bridge runs them in Pi.

Legend: `✓` supported, `✗` not supported, `⚠` partial (see notes).

The upstream column reflects Claude Code's published [skills](https://code.claude.com/docs/en/skills) and [plugins](https://code.claude.com/docs/en/plugins-reference) references, and the Claude Code binary. The skills report, [`docs/research/parity-gaps/skills-commands.md`](research/parity-gaps/skills-commands.md), read the 2.1.322 binary. The file mention rules, the command name, and the argument hint were read in the 2.1.323 binary. The Pi column reflects Pi 1.5.0, the sources under `extensions/pi-claude-marketplace/domain/`, `extensions/pi-claude-marketplace/orchestrators/`, `extensions/pi-claude-marketplace/edge/`, `extensions/pi-claude-marketplace/bridges/skills/`, and `extensions/pi-claude-marketplace/bridges/commands/`, and the behavior that the cucumber scenarios under `features/skill/` and `features/slash-command/` prove. A note names its decision ID, such as `D-CF1-01`. A note that describes a difference from Claude Code also names its reason: a Pi gap (Pi has no matching capability) or a project decision.

## Name mapping

A plugin skill is a Pi skill named `/skill:<plugin>-<folder>`, from the name of its source folder (D-CF2-01). A frontmatter `name` does not change the Pi name. A skill also answers to the names that Claude Code gives it (D-CF2-02): `/<plugin>:<folder>`, `/<plugin>:<name>` for a frontmatter `name`, and the bare `/<name>` when the name has no colon. These aliases work in interactive sessions and over RPC. The first skill wins a name that two skills claim.

A plugin command is a Pi prompt template named `/<plugin>:<name>`. A command in a subfolder of `commands/` gets its folder names joined with colons, such as `/demo:build:web`. On Windows, Pi joins the names with `.`. When the first part of the path starts with `<plugin>-`, the bridge removes that part from the Pi name, so `demo-lint.md` in plugin `demo` is listed as `/demo:lint` (D-141-01). The bridge keeps the part when the removal leaves it empty, so `demo-.md` stays `/demo:demo-` (D-141-02).

Claude Code names a command with the plugin name and the path of the command file in `commands/` without `.md`, all joined with colons, and it never removes a part. So the Pi name and Claude Code's name differ for a file whose name starts with `<plugin>-`, and on Windows. When they differ, the command also answers to Claude Code's name (D-PG11-01). For example, `demo-lint.md` is listed as `/demo:lint` and also answers to `/demo:demo-lint`. The listed name keeps the removal of D-141-01. A command also answers to `/<plugin>:<name>` for a frontmatter `name`, and to `/<name>` when the name has no colon. Command aliases use a colon on every platform.

An alias that is the name of another loaded Pi command is not added. An alias that two skills or commands claim goes to the first one, and every skill claims a name before any command. A plugin that was installed before this release gets the alias of D-PG11-01 when it updates to a new version, or at `/claude:plugin reinstall`. The load does not rewrite staged files.

When you type an alias, a `UserPromptExpansion` hook still gets the Pi name of the command as `command_name` (D-PG6-19). Claude Code sends its own name there. See [UserPromptExpansion](hooks-compatibility.md#userpromptexpansion).

A frontmatter `name` on a command in a subfolder can differ too. One fragment of the 2.1.323 binary reads as if Claude Code replaces only the last part of the name, so `commands/build/web.md` with `name: x` answers to `/<plugin>:build:x`. The bridge gives `/<plugin>:x`. This was read in the binary, not traced and not run.

## Alias suggestions

When the typed text holds a colon, Pi's terminal menu suggests the aliases that match it. Each alias row shows the argument hint and the description of the skill or command that the alias names, in Pi's own format for a command row: the hint, a dash, and the description, or one of them alone (D-PG11-09). A skill's description includes its `when_to_use` text. Claude Code's `/` menu also lists a name with its description and its argument hint.

Claude Code 2.1.323 reads `argument-hint` as text. So a hint written as a YAML list, such as `argument-hint: [change]`, shows as `change`, without its brackets. A hint that is a mapping shows no hint in Pi.

Pi's own `/skill:` row of a skill has no place for a hint. So Pi shows a skill's `argument-hint` on its alias rows only, and only once the typed text holds a colon. Typed text with no colon, such as `/fan`, gets no alias suggestion.

## Typed arguments and variables

When you type a skill or a command, the bridge fills its body with your arguments as Claude Code 2.1.316 fills it (D-CF1-01). Placeholders count from 0, as in Claude Code, so `$0` is the first argument. Pi's own templates count from 1. The body takes `$N`, `$ARGUMENTS[N]`, `$ARGUMENTS`, and `$name` for a name in the frontmatter `arguments`. `\$` keeps a literal `$`. When no placeholder takes an argument, the bridge appends `ARGUMENTS: <your text>`, as Claude Code does. Pi's own expansion of a prompt template does not run on a plugin command. A template that you wrote yourself keeps Pi's expansion.

The variables in a body get these values:

- `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` are filled at install. In a skill, `${CLAUDE_SKILL_DIR}` is the staged copy of the skill folder, outside the plugin tree.
- `${CLAUDE_SESSION_ID}` and `${CLAUDE_EFFORT}` are filled when you type the skill or command. The effort is the thinking level of the Pi session.
- `${CLAUDE_PROJECT_DIR}` is filled at install for a project-scope plugin. A user-scope skill or command keeps it in its staged file. The bridge fills it with the working directory of the session when you type the skill or command, when the model reads a skill file, and when the model runs a command with `run_plugin_command` (D-PG10-16).
- `${user_config.KEY}` is filled when the content is staged: at install, update, reinstall, and enable (D-PG10-13). A sensitive option becomes a fixed text that says the value is not available. An option with no default stays as written. A plugin that declares no `userConfig` keeps every `${user_config.KEY}` as written, as Claude Code does.

For each variable and each surface, see [Environment variables](env-vars.md).

## Context commands

A `` !`command` `` and a ```` ```! ```` block in a body run when you type the skill or command (D-CF1-02). They run after the argument substitution, once, in the working directory of the session, and their output replaces them. The bridge escapes a `!` at the start of a word in an argument, so an argument cannot form a command. A command that fails stops the invocation with Claude Code's message, and nothing reaches the model. A body with `shell: powershell` runs its commands through bash off Windows, as Claude Code does.

Pi has no permission modes, so every command runs, as in Claude Code's `bypassPermissions` mode. Two differences from Claude Code stay: the bridge keeps stderr apart from stdout, and it does not cut a long output (D-CF1-02). The model's read of a skill file and the `run_plugin_command` tool run no command (D-CF1-03).

## File mentions

When you type a skill or a command, the bridge attaches the files that its body names with an `@` path (PG-SKILL-01). The mention syntax follows Claude Code 2.1.323 (D-PG11-04):

- `@"path with spaces"` and an unquoted `@path` are mentions. The `@` starts a word, or it follows one of four CJK marks: the ideographic full stop, the ideographic comma, and the fullwidth question and exclamation marks.
- The bridge cuts the characters that are not word characters from the end of an unquoted path.
- A `#L10` or `#L10-20` suffix selects those lines of the file.
- `@agent-<name>` and a quoted value that ends with a space and `(agent)` name an agent, not a file.
- A relative path starts from the working directory of the session, and `~` is your home directory.
- A file that the body names twice is attached once.

Each attached file is added after the body in Pi's own form, `<file name="<path>">`, then the file text, then `</file>`, in the order of the mentions (D-PG11-05). The `@path` text stays in the body, as in Claude Code. In a skill, the file blocks go inside the skill block, before its closing line, because Pi shows text after that line as your own message. Claude Code sends a Read call and its result as separate messages. Reason: Pi gap. An `input` transform can send text only. Claude Code lists the quoted mentions before the unquoted ones, and the bridge keeps the order of the body.

A mention is attached only when its path names a regular file of at most 262,144 bytes that holds no NUL byte (D-PG11-06). The bridge follows a symbolic link to its target. A file of more than 2,000 lines is cut to its first 2,000 lines, with this note after the block:

```text
Note: The file <path> was too large and has been truncated to the first 2000 lines. No need to mention the truncation. Use the read tool to read more of the file if you need.
```

Any other mention stays as text, and the invocation goes on with no notice: a missing path, a directory, a file that is too large, a binary file, or a file that cannot be read. Claude Code also drops a missing mention with no notice.

These rules differ from Claude Code 2.1.323. None of them is parity:

- Only the mentions that the plugin author wrote are attached (D-PG11-02). The bridge finds the mentions in the body after it fills the path variables and before it adds your arguments and runs the `!` commands. A path in your arguments, or in the output of a `!` command, is not attached. Claude Code finds the mentions in the finished text, so it also attaches those paths, after it checks each one against its Read deny rules. Reason: Pi gap. Pi has no read permission rules, and the attachment does not go through Pi's read tool, so no `PreToolUse` hook on `Read` sees it. With no gate, a typed or forwarded argument can name any file for the bridge to read.
- A mention inside fenced code or inside a code span is not attached (D-PG11-03). A fence starts with three or more backticks or tildes. Claude Code reads every word and attaches these mentions too. Reason: project decision, with no Pi gap behind it. Plugin-authoring guidance shows `@` paths as examples inside code, and the decision keeps those example files out. An indented block of four spaces is not treated as code, so a mention in it is attached.
- A directory is not attached (D-PG11-06). Claude Code attaches a directory as the output of `ls`. Reason: project decision. The requirement names regular text files only.
- Claude Code tells the model that a file over the size limit was not read. The bridge gives no notice (D-PG11-06).

An attachment can reach any file that you can read and that the plugin author named, in the plugin or outside it. The bridge asks for no approval, and no `PreToolUse` hook on `Read` runs for the attachment. A `!` command in the same body can already read the same files (D-CF1-02), so the bridge applies no containment rule (D-PG11-08). The attachment reads files and writes none. A project skill or command of a project that Pi does not trust reads no file.

Attachment runs only on the skills and commands that you type, by the Pi name or by an alias (D-PG11-07). The `run_plugin_command` tool and the model's own read of a skill file attach nothing.

Three upstream facts on this page were read in the Claude Code 2.1.323 binary or documentation and were not run:

- Claude Code follows a symbolic link when it reads a mention. The Read path follows one, and no separate check was found.
- Whether Claude Code attaches files when the model starts a skill with the Skill tool. The caller that sets the flags for that path was not traced.
- Where Claude Code removes the agent mentions. The filter was inferred from a caller of the mention parser.

## Frontmatter fields

Pi reads only `name`, `description`, `argument-hint`, and `disable-model-invocation`. The bridge handles the other fields of a skill or a command this way:

- `disallowed-tools`, `model`, `effort`, `agent`, `context`, `background`, `hooks`, and `paths` are dropped. Install shows one warning, `[<source>] dropped fields: ...`, with the fields in frontmatter order (D-CF1-05). Each field asks for something that Pi does not do for one skill or command, such as another model or a subagent.
- `allowed-tools` is ignored with no warning. In Claude Code it only grants tools, and Pi runs every tool without asking.
- `arguments` and `shell` work, as described above (D-CF1-01, D-CF1-02).
- `argument-hint` on a command shows in Pi's own row of the command. A manifest `argumentHint` wins over the hint in the file. On a skill, the hint shows on the alias rows only (D-PG11-09).
- `disable-model-invocation: true` on a skill leaves the skill out of the model's skill list, and you can still type it. On a command, the `run_plugin_command` tool refuses it with Claude Code's text. Pi reads only the boolean `true`.
- `user-invocable: false` keeps the skill or command listed, and you can still type it (D-CF1-09 for skills, D-CF3-02 for commands). Claude Code hides it from `/`. Reason: Pi gap. Pi cannot hide a skill's slash command or a prompt template.

## The model's command tool

Pi gives the model no way to run a prompt template, and the model's system prompt lists no plugin command. The bridge registers the `run_plugin_command` tool for that path (D-CF3-01, as amended). Its description lists the commands that Claude Code lists for the model, under the names that Pi shows. The bridge builds the list once, at the first `before_agent_start` of a session, and registers the tool only when the list holds a command.

A call returns the command's body filled as a typed command fills it, with the model's arguments. Its `!` commands stay literal and do not run, and it attaches no file. The tool refuses a command with `disable-model-invocation: true`. It lists a project command only when Pi trusts the project (D-LOC-01).

## The skill-read fill

Pi lists each skill for the model in its system prompt, and the model reads the skill's `SKILL.md` with Pi's read tool. The bridge fills that read text (D-CF1-03, as amended). The model gets the `${CLAUDE_*}` values filled, with `$ARGUMENTS` and the named arguments empty, as a typed skill with no arguments has them. The `!` lines stay literal and do not run, and no file is attached. The frontmatter lines stay as staged, and a read with an offset or a limit gets the same lines filled.

The fill runs only while the read text is still the skill's own. When a `PostToolUse` hook replaces the read text, the model gets the hook's text as the hook wrote it, with nothing filled, as Claude Code sends a hook's replacement. A project skill gets the fill only when Pi trusts the project (D-LOC-01).

## Status

The status table follows.

## Not proven by a scenario

The list of behaviors that no scenario proves follows.

## Deferred for engineering reasons

A faithful Pi-side behavior is possible for these, but it is not built yet:

- A directory mention attached as a listing, as Claude Code attaches the output of `ls` (D-PG11-06).
- Images, notebooks, and PDFs as attachments. Claude Code gives each one its own form.
- Attachment on the two model paths: the `run_plugin_command` tool and the model's read of a skill file (D-PG11-07).
- Alias suggestions before you type a colon.

## Further reading

- [Claude Code skills reference](https://code.claude.com/docs/en/skills) -- the upstream reference for skill frontmatter, arguments, variables, context commands, and `@` references.
- [Claude Code plugins reference](https://code.claude.com/docs/en/plugins-reference) -- the upstream reference for plugin components, command names, and the `commands` and `skills` manifest fields.
- [Hook compatibility](hooks-compatibility.md) -- the hooks that run for a typed skill or command, including `UserPromptExpansion`.
- [MCP compatibility](mcp-compatibility.md) -- plugin MCP servers and their tool names.
- [Workflow compatibility](workflows-compatibility.md) -- plugin workflows and the names that commands and skills use for them.
