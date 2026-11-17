# Phase 11: Skills, Commands, and Records - Research

**Researched:** 2026-11-15
**Domain:** Typed skill and command invocation (`@file` attachment), command alias names, alias suggestions, two documentation tasks
**Confidence:** HIGH for the current code and the upstream parser (both read this session); MEDIUM for upstream facts that only a live Claude Code session can settle (marked in place)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Decision 13: Claude Code's command name as an alias (PG-CMD-09) -- comes first

- **D-PG11-01 (pending maintainer review; decision 13; amends D-141-01):**
  Add the alias. A bridged command also answers to `/<plugin>:<path>:<file>`,
  Claude Code's name for it, whenever that differs from its Pi name. The Pi
  listing name keeps the D-141-01 / D-141-02 elision (`demo/commands/demo-lint.md`
  still lists as `/demo:lint`); `/demo:demo-lint x` sends the same body.
  - **Evidence record.** Question: what does Claude Code call
    `asana/commands/asana-setup.md`? Answer: `/asana:asana-setup`; the name is
    `<plugin>:<path with / as :>:<file>` and is never elided (skills report
    CMD-09, VERIFIED against the 2.1.322 builder `B6`; DOCS plugins-reference,
    2026-11-15: "each key becomes the command name after the plugin prefix").
    Confidence: high. Today command aliases come only from frontmatter `name`
    (`orchestrators/skill-alias-state.ts:153-159`, `COMMAND_KIND.names`), while
    a skill in the same case keeps its Claude Code name as an alias. The
    asymmetry has no recorded reason (skills report "Divergences", item 5).
  - **License for D-141-01 itself:** a house rule (CM-2), not a Pi gap. This
    decision does not remove it; it removes only the loss of the upstream
    name. Reversible: dropping the alias later removes one alias source.
  - **Windows:** the Pi name there is `/foo.bar`; the colon name `/foo:bar`
    differs from it, so it is an alias too (the requirement's "whenever that
    name differs"). The README states "Command aliases use a colon on every
    platform".
  - **Where the name comes from:** computed at stage time from the source
    path (the un-elided `generatedCommandName` form) and stored where the
    alias reader finds it, as skills store theirs (`readSkillRecord` in the
    staged frontmatter). The storage spot is the agent's discretion. A command
    staged before this phase gets the alias at its next restage; the load does
    not rewrite staged files (APL-D1). The CHANGELOG says so.
  - **Collisions:** the existing alias rules apply unchanged: an alias that
    is any loaded Pi command name, or that two entries claim, is not added
    (`claimedAliases`). A Claude Code name equal to another command's Pi name
    therefore keeps the Pi name.
  - Record: a Key Decisions row in `PROJECT.md` with the premise and the
    2.1.323 version; "Amended by D-PG11-01" on D-141-01.

### `@file` attachment (PG-SKILL-01, spike S8)

S8 findings that decide this area (`11-SPIKE-S8.md`, binary 2.1.323):
Claude Code scans the **rendered** content -- after argument substitution and
after `!` output is inlined -- with a whitespace tokenizer that ignores
Markdown. So upstream attaches a path that arrives through an argument or
through `!` output, and a path inside a code span or fence. Each attached path
first passes Claude Code's Read deny rules. The locked requirement and success
criteria 1 and 2 say the opposite for all three.

- **D-PG11-02 (pending maintainer review; divergence; PG-SKILL-01, criterion 1):**
  Attach only `@path` references the author wrote: mentions are found in the
  body after the path variables are filled (`${CLAUDE_PLUGIN_ROOT}`,
  `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}`,
  `${user_config.KEY}`) and before arguments are substituted and `!` commands
  run. No mention is read from argument text or `!` output, wherever it lands.
  - **License (Pi capability gap):** upstream gates every attached path on
    the Read deny rules (`mvr(path, ctx, "person")`). Pi has no permission
    rules, and an attachment made in the `input` transform does not pass
    through Pi's read tool, so the hooks bridge's `PreToolUse` on `Read` never
    sees it. Attaching argument paths would let a typed or forwarded argument
    read any file with no gate at all. Parity is the same rule with a gate,
    and Pi cannot supply the gate.
  - **Not taken:** parity (scan the rendered text). It would attach
    `/demo:review @/etc/hostname`, which criterion 1 forbids.
  - **Reversible:** switching to the rendered text is a change of the scan
    input only.
- **D-PG11-03 (pending maintainer review; divergence with no Pi gap; criterion 2):**
  A mention inside fenced code (```` ``` ```` or `~~~`) or an inline code span
  is not attached. Upstream attaches it. The license is this recorded
  decision: the requirement chose it to avoid attaching example text in
  plugin-authoring guidance (`plugin-dev` teaches the `@` pattern inside code
  in more than 20 places, so parity would attach the files its examples name,
  when they exist). No doc may call it parity. Maintainer question: keep the
  skip, or follow upstream and change criterion 2.
- **D-PG11-04 (syntax; parity):** recognize mentions as upstream does
  (`z_s`, `R3n`, `sls`): `@"path with spaces"` and an unquoted `@token`, where
  `@` starts a whitespace-delimited token or follows one of `。、？！`; trailing
  non-word characters are cut; a `#L10` or `#L10-20` suffix is a line range
  (attach those lines only); `@agent-...` and `@"... (agent)"` are not files.
  A relative path resolves against the session directory, and `~` expands to
  the home directory. A mention is attached once even if it repeats.
- **D-PG11-05 (form; Pi gap):** each attached file is appended after the
  rendered body as Pi's own form, `<file name="<abs>">\n<content>\n</file>`
  (`PI/dist/cli/file-processor.js:60`), in mention order. Upstream sends a
  synthetic Read call and result as meta messages, which an `input` transform
  cannot produce. The `@path` text stays in the body, as upstream leaves it.
- **D-PG11-06 (what qualifies; requirement plus parity limits):** a mention is
  attached only when, at invocation, the path names a regular file (`stat`,
  which follows a symbolic link; the target must be regular), its size is at
  most 262,144 bytes (upstream `maxSizeBytes`), and it is text (no NUL byte in
  the read bytes; the exact test is the agent's discretion). A file over 2,000
  lines is cut to its first 2,000 lines with upstream's note text adapted to
  Pi. Anything else -- missing, a directory, too large, binary, unreadable --
  is not attached, the literal stays, and the invocation goes on without a
  notice (upstream drops a missing or denied mention silently). Upstream
  attaches a directory as an `ls` listing; the requirement names only
  regular text files, so a directory is left as text and deferred. Symbolic
  links: followed, as upstream's Read path does (unverified by probe).
- **D-PG11-07 (surfaces):** attachment runs on typed invocations only: the
  command invocation and the skill invocation, aliases included
  (`orchestrators/command-invocation.ts`, `orchestrators/skill-invocation.ts`),
  on the line the `UserPromptExpansion` work of Phase 6 also changes. The
  `run_plugin_command` result and the skill-read fill do not attach; upstream's
  Skill-tool path is unverified (S8 Q4), and that work is deferred. Arguments
  the model passes to `run_plugin_command` are covered by D-PG11-02 either
  way.
- **D-PG11-08 (module):** a pure parser in `domain/` (mentions with their
  ranges, the code-span and fence mask) and the file read behind an injected
  reader in the invocation orchestrators. All reads are read-only; no
  containment rule applies, because the author can already run `!` commands
  (D-CF1-02).

### Alias suggestions (PG-SKILL-11)

- **D-PG11-09 (parity via Pi's own format):** each alias suggestion carries
  `description` built the way pi-tui builds it for a native command:
  `` `${argumentHint} — ${description}` ``, or either part alone
  (`node_modules/@earendil-works/pi-tui/dist/autocomplete.js:236-238`). The
  description and hint are the alias target's, read from its staged
  frontmatter (a skill's `description`, which already applies the
  `when_to_use` fallback, and its `argument-hint`; a command's
  `description` and `argument-hint`). Upstream's `/` menu lists the name with
  its description and argument hint (skills report SKILL-11, VERIFIED). The
  rule that alias suggestions appear only once the typed text holds `:` stays
  (taste question the report leaves open). `argument-hint` on a skill joins
  no dropped-fields warning: it is now shown.

### Records (PG-DOC-02, PG-DOC-01)

- **D-PG11-10 (`PATH` row, from S8 Q5):** correct the `PATH` row of
  `docs/env-vars.md` (line 28 matrix, and the hook and MCP rows at about 122
  and 161): Claude Code 2.1.323 puts the plugin `bin` on the `PATH` of the
  Bash and PowerShell tools only; hooks and MCP servers do not get it
  (`getEnabledPluginBinPaths` consumers; DOCS plugins-reference "on the Bash
  tool's `PATH`"). Pi appends it to the process `PATH`, so hooks and MCP
  servers inherit it: that is more than upstream, recorded as a divergence
  whose behavior change stays deferred (core report N5).
- **D-PG11-11 (the other seven rows, as the PRD's section 10 states them):**
  the event count (Pi 1.5.2 has 41 extension events, not 31) and the
  first-party claim (`claude-security` uses two unsupported events) in
  `docs/research/claude-hooks-vs-pi-events.md`; in `docs/mcp-compatibility.md`
  and the code comments that repeat them, the `tool_search` claim (Pi's
  codemode also reaches plugin tools), the bundle reason (Claude Code has no
  bundle runner either; it unpacks the bundle, so the blocker is project
  work), and the proof paths (right only for Pi 1.5.0; the code moved to
  `@earendil-works/pi-mcp` in 1.5.1); BACKLOG `TOOLSEARCHOFF-01`, `WOUT-01`
  (out of date since engine 3.13.1), and `UAT-02` (Pi rebuilds the chat before
  `session_start` since 0.79.10); and the "Component" entry in section 3 of
  `docs/prd/pi-claude-marketplace-prd.md` (hooks and workflows are supported).
  Each correction names its source and version. A claim that only a run can
  settle is marked **unmeasured**: the `UAT-02` fix ("read in code, not run"),
  the codemode reach, and the WOUT-01 engine claim unless the research finds a
  scenario that proves it. The research re-reads each target line, since
  earlier phases moved text (Phase 10 moved the env-vars PATH text).
- **D-PG11-12 (PG-DOC-01; last plan):** `docs/skills-commands-compatibility.md`
  follows the register of `docs/hooks-compatibility.md` and covers the
  dropped fields, `!` injection, `run_plugin_command`, the skill-read fill,
  the name mapping (with D-PG11-01), and `@file` attachment with D-PG11-02 and
  D-PG11-03 marked as divergences. The status table starts from the skills
  report's "Current project behavior" table. Every row cites a scenario
  (`features/...feature:<line>`) that passes on the combined tree; a behavior
  with no passing scenario goes into a separate "Not proven by a scenario"
  list, not into the table. README's name-mapping section links to the page.

### Behavioral evidence

- **D-PG11-13:** each user-visible change ships a cucumber scenario that
  fails without it:
  - a command body `Review @${CLAUDE_PLUGIN_ROOT}/templates/x.md` reaches the
    scripted model with the template text in a `<file>` block (criterion 1);
  - `/demo:review @/etc/hostname` (use a fixture file in the scenario's
    world, not the real `/etc/hostname`, if the harness requires hermetic
    paths) reaches the model as text with no `<file>` block (criterion 1);
  - a mention in a fence, in a code span, and in `!` output is not attached
    (criterion 2);
  - a skill body mention attached through an alias invocation;
  - `/demo:demo-lint x` sends the body of `demo/commands/demo-lint.md`, as
    `/demo:lint x` does (criterion 3);
  - `features/skill/aliases.feature` and
    `features/slash-command/aliases.feature` assert the description column,
    with the `argument-hint` for a skill (criterion 4).
  Owner unit tests cover the mention parser (quoted, unquoted, CJK
  punctuation, trailing punctuation, line ranges, agent forms, fences, code
  spans), the qualification checks, and the alias name. All tests run in a
  hermetic home and never touch the real `~/.pi/agent`.

### Records written by this phase

- **D-PG11-14:** append Key Decisions rows D-PG11-01, D-PG11-02, D-PG11-03 to
  `PROJECT.md`, each with its premise and versions and marked pending
  maintainer review; "Amended by D-PG11-01" on D-141-01. Fill the S8 cell of
  the PRD's section 9 table with a pointer to `11-SPIKE-S8.md` for the two
  questions it answered. One CHANGELOG bullet (the `changelog` skill),
  including the restage note of D-PG11-01.

### Decided autonomously

Reversible technical choices: D-PG11-04 to D-PG11-13.

### Pending maintainer review

- D-PG11-01 (decision 13): add Claude Code's command name as an alias;
  amends D-141-01.
- D-PG11-02: attach author-written mentions only; upstream also attaches
  argument and `!` output paths (licensed by the missing Read permission gate
  in Pi).
- D-PG11-03: skip mentions in code; upstream does not, and no Pi gap licenses
  it.
- D-PG11-06: a directory mention is not attached; upstream attaches an `ls`
  listing.

### Claude's Discretion

Where the Claude Code command name is stored at stage time; the text test of
D-PG11-06; the truncation note wording; module placement and names; scenario
wording and splits; plan splits. No exception to plan size, security,
coverage, or verification gates.

### Deferred Ideas (OUT OF SCOPE)

- Attaching on `run_plugin_command` and the skill-read fill, once upstream's
  Skill-tool path is probed (S8 Q4).
- Directory mentions as a listing (upstream parity).
- Image, notebook, and PDF mentions.
- Narrowing the plugin `bin` to the bash tool (core report N5); D-PG11-10
  records the divergence only.
- Alias suggestions before a `:` is typed.
- The stale records in the skills report's list that no requirement owns
  (env-vars line ~180 text, SKILLMODEL-01, D-CF3-02, D-CF3-06 residuals,
  `invocation-frontmatter.ts:2-5`).
- The other S8 questions (MCP-03 `blocked` tool, SKILL-06 root `SKILL.md`,
  decision 26 `paths`, the 2.1.322 name clash).
</user_constraints>

## Summary

The phase is five small pieces of work on code that already exists. No package is added. Three pieces change behavior a user can see (PG-CMD-09, PG-SKILL-11, PG-SKILL-01), and two change documents (PG-DOC-02, PG-DOC-01).

The typed invocation path has no separate "variable fill" step today. `substituteArguments` fills the `${CLAUDE_*}` variables and the arguments in one call. But that function already has a variables-only branch (`args: undefined`), so the text that D-PG11-02 wants scanned, "after the variables, before the arguments", is one extra call with no change to the substitution core. The path variables themselves are filled at staging, so a staged command body already holds the absolute path of `@${CLAUDE_PLUGIN_ROOT}/templates/x.md`.

The Claude Code name of a command needs storage, because the D-141-01 elision loses the file name. The staging writer already holds everything the name needs (`pluginName` and `sourceName`), and the trusted record key in the staged frontmatter is the right place for it. The alias table reads each staged file once already, so the description and `argument-hint` for PG-SKILL-11 come from the same read at no extra I/O.

Ten findings change or sharpen a locked decision or a record; they are in "Findings that change decisions". The two that matter most: an inline `` !`cmd` `` must be masked as a code span or its command text gets attached (F2), and the PRD's finding that `claude-security` uses two unsupported hook events is half out of date, because Phase 6 admitted `UserPromptExpansion` (F6).

**Primary recommendation:** build in this order, one plan after another in one worktree: PG-CMD-09 (stored name, alias), PG-SKILL-11 (alias description), the pure mention parser, the attachment wiring for commands and then skills, the PG-DOC-02 corrections, the decision records, and PG-DOC-01 last.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
| --- | --- | --- |
| PG-SKILL-01 | A typed bridged command or skill attaches each author-written `@path` that names an existing regular text file; not from an argument, not from `!` output, not inside fenced code or a code span | "Current code: typed invocation" (insertion points with lines), "Upstream mention parser" (verbatim 2.1.323 code), F1, F2, F3, F12, Patterns 1 and 2, Pitfalls 1 to 6 |
| PG-CMD-09 | A bridged command also answers to `/<plugin>:<path>:<file>` when that differs from its Pi name | "Current code: command names and aliases", F10, F11, F15, Pattern 3, Pitfalls 7 and 8 |
| PG-SKILL-11 | Each alias suggestion shows its target's description and, for a skill, its `argument-hint` | "Current code: alias suggestions", F4, F5, Pattern 4, Pitfalls 9 and 10 |
| PG-DOC-01 | `docs/skills-commands-compatibility.md`; each status row cites a passing scenario | "PG-DOC-01: status table map" (rows with `features/...:<line>`), the "Not proven by a scenario" list, the citation check command |
| PG-DOC-02 | The eight statements of PRD section 10 marked "none" are corrected; a claim only a spike can settle is marked unmeasured | "PG-DOC-02: the eight rows" (current lines, corrected text, source, measured or unmeasured), F6 to F9 |
</phase_requirements>

## Findings that change decisions

Each finding names the decision or record it touches. None reopens a locked decision; each tells the planner how to carry it out.

### F1. There is no separate variable-fill step; use the variables-only branch (D-PG11-02)

`substituteArguments` fills variables and arguments in one call (`domain/argument-substitution.ts:241-264`). With `args: undefined` it returns `applyVariables(input.body, variables, (value) => value)` and stops (`:243-245`). That text is exactly "the body after the path variables are filled and before arguments are substituted". [VERIFIED: extensions/pi-claude-marketplace/domain/argument-substitution.ts:241-264]

Path variables are filled at staging for commands (`bridges/commands/staged-command.ts:275-287`, `substituteClaudeContent`) and for skills, so at invocation the staged body already holds absolute paths. The invocation pass fills only `CLAUDE_SESSION_ID`, `CLAUDE_EFFORT`, `CLAUDE_PROJECT_DIR` at user scope (D-PG10-16), and `CLAUDE_SKILL_DIR` for an argument. [VERIFIED: orchestrators/command-invocation.ts:156-174, orchestrators/skill-invocation.ts:141-157]

So: scan `substituteArguments({ body, args: undefined, argumentNames: [], variables })`. Do not change `argument-substitution.ts`.

### F2. An inline `` !`cmd` `` must count as a code span (D-PG11-02, D-PG11-03)

`domain/context-injection.ts:80-85` has a code-span mask, but it leaves a span unmasked when `!` or a backtick comes right before it, on purpose, so that it can find the commands. It cannot be reused. The mention mask must blank every code span and every fence, the ```` ```! ```` fence included. Without that, the body `` Files: !`cat @/abs/x.md` `` gives the whitespace token `@/abs/x.md` followed by a backtick, upstream's tail cut removes the backtick, and the file is attached from the command text. [VERIFIED: extensions/pi-claude-marketplace/domain/context-injection.ts:61-85; upstream tail cut in "Upstream mention parser"]

### F3. Find the mentions before the `!` commands run, read the files after

Upstream attaches after the `!` commands ran (S8 Q1). A body can write a file with a `!` command and name it with `@`. Under D-PG11-02 the mention list comes from the author's text, but nothing forces the `stat` and the read to happen early. Do the scan first and the reads after `expandContextInjections` returns. A refused invocation (a failed `!` command) then reads nothing. [ASSUMED: this ordering is my recommendation; no decision records it]

### F4. Upstream reads `argument-hint` with `String()` (D-PG11-09)

Claude Code 2.1.323 builds the hint as `argumentHint:q["argument-hint"]!=null?String(q["argument-hint"]):void 0`, in the plugin skill builder and the plugin command builder alike. So `argument-hint: [file]`, which YAML reads as a list, shows as `file`. Pi's own template loader takes a string only (`dist/core/prompt-templates.js:119`). [VERIFIED: Claude Code 2.1.323 binary strings, read this session; Pi line by grep]

Recommendation: the alias description uses the string as it is, and `String(value)` for a number, a boolean, or a list of scalars; a mapping gives no hint. This follows upstream and avoids `[object Object]`.

### F5. Three existing scenario rows pin an empty alias description (PG-SKILL-11)

These rows turn red when alias suggestions gain a description, and they are the "fails without the change" proof for the command side:

- `features/slash-command/aliases.feature:116-118`: row `demo:fancy` with empty hint and description. New expectation: description `Ships the branch.`
- `features/slash-command/frontmatter.feature:193-196`: row `demo:demo-skill` (a skill alias in the `/demo:de` menu) with an empty description. New expectation: the default fixture skill's description, `A skill of demo 1.0.0.` (the text at `frontmatter.feature:165`).

`features/slash-command/manifest-forms.feature:755-757` holds no alias row and does not change. [VERIFIED: the three files, read this session]

### F6. The PRD's hooks finding is half out of date (PG-DOC-02 row 1)

PRD section 10 says `claude-security` uses two unsupported events. They are `UserPromptExpansion` and `PermissionRequest` [CITED: docs/research/parity-gaps/hooks.md:86, :468]. Phase 6 admitted `UserPromptExpansion`: the admitted tuple is

```ts
const ADMITTED_EVENT_NAMES = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
  "Stop",
  "StopFailure",
  "UserPromptExpansion",
] as const satisfies readonly ClaudeHookEvent[];
```

[VERIFIED: extensions/pi-claude-marketplace/domain/components/hook-events.ts:51-63]

The corrected statement must say: the official marketplace uses nine distinct events; one of them, `PermissionRequest` (`claude-security`), is not supported; `UserPromptExpansion` is supported since D-PG6-18.

### F7. WOUT-01 is already corrected, and a scenario proves the engine claim (PG-DOC-02 row 5)

Phase 8 added an "Out of date 2026-11-15" paragraph at `.planning/BACKLOG.md:3831`. It cites the scenario at `features/workflow/agent-steps.feature:96`, where two workflow subagents each call `bash` and get its result (`:121-126`). The harness runs engine 3.15.0 (`node_modules/.cache/optional-peers/node_modules/@quintinshaw/pi-dynamic-workflows/package.json`). So "a workflow subagent gets tools" is **measured** at 3.15.0. The boundary "since 3.13.1" is read in the engine source, not run [CITED: docs/research/parity-gaps/workflows.md:208]. Two leftovers: the entry's heading still says "engine subagents declined every tool call", and `.planning/ROADMAP.md:580` says "workflow output is unobserved", which stays true for output quality on a real plugin.

### F8. The event count of 41 also holds for Pi 1.5.0 (PG-DOC-02 row 1)

The installed Pi 1.5.0 declares 41 `on(event: "...")` overloads, `dist/core/extensions/types.d.ts:1210-1250`. The hooks report counted 41 in 1.5.2. [VERIFIED: `grep -c` over the installed file this session; the 1.5.2 count is CITED: docs/research/parity-gaps/hooks.md:92]

### F9. The MCP proof paths: what moved, and which comments repeat them (PG-DOC-02 row 4)

The installed Pi 1.5.0 still has `dist/extensions/mcp/tools.js`, `config.js`, and `oauth.js`. The package `@earendil-works/pi-mcp@1.5.2` has `dist/naming.js`, `dist/config.js`, and `dist/oauth/index.js` [VERIFIED: `npm pack @earendil-works/pi-mcp@1.5.2 --dry-run --json`, file list, this session]. That the move happened in 1.5.1 is [CITED: docs/research/parity-gaps/mcp.md:24].

`docs/mcp-compatibility.md` names `dist/extensions/mcp` on 31 lines. Only two code comments still carry such a path, not the four the mcp report listed:

- `extensions/pi-claude-marketplace/bridges/mcp/builtin-overrides.ts:12-13`
- `extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts:5-6`

Both already say "Pi 1.5.0". The bundle claim is repeated in `extensions/pi-claude-marketplace/domain/mcp-resolution.ts:75-76` and in the scenario description at `features/mcp-server/sources.feature:405-406`.

### F10. The alias changes nothing in the `UserPromptExpansion` payload (D-PG6-19)

The typed-line resolver and the alias handler share one name table (`index.ts:182-186`, `:383`). Once `/demo:demo-lint` is in the table, `aliasExpansion` (`orchestrators/typed-expansion.ts:85-98`) resolves it with no code change, and the hook's `command_name` is the Pi name `demo:lint`, as D-PG6-19 records. Claude Code would send `demo:demo-lint`. Changing that amends D-PG6-19 and is not in PG-CMD-09's text. See Open Question 1.

### F11. The Claude Code name is `<plugin>:<sourceName with / as :>`, and install already computes it for one purpose

`DiscoveredCommand.sourceName` is the path relative to its `commands/` directory without `.md`, the basename for a declared file, and the key for a map entry (`bridges/commands/types.ts:43-46`, `discover.ts:301`, `:451`, `:578`). `commandUpstreamNames` (`bridges/skills/skill-names.ts:256-272`) already builds `<plugin>:<basename>` and `<plugin>:<key>` so that a skill never claims a command's name (D-CF2-03). So a skill and a command of one plugin cannot both hold `demo:demo-lint`: install skips the skill (`features/skill/collisions.feature:13`). The rule "skills claim before commands" therefore cannot take a command's Claude Code name inside one plugin. [VERIFIED: the cited files, read this session]

### F12. In a skill, the `<file>` blocks belong inside the `<skill>` block (D-PG11-05)

Pi reads a skill message with `/^<skill name="([^"]+)" location="([^"]+)">\n([\s\S]*?)\n<\/skill>(?:\n\n([\s\S]+))?$/` and shows the text after `</skill>` as the user's own message (`dist/core/agent-session.js:63-72`). Blocks placed after `</skill>` would display as if the user typed the file. Put them after the rendered body and before `\n</skill>`, which is also the literal reading of D-PG11-05 ("after the rendered body"). [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js:63-72]

### F13. Phase 6's handler is untouched by design

`registerHooksBridge` registers its `input` handlers at `index.ts:183-186`, before `registerSkillAliases` (`:383`) and `registerCommandInvocation` (`:386`). Pi runs input handlers in registration order, so `UserPromptSubmit` and `UserPromptExpansion` hooks see the typed line before any transform. The attachment lives in the two invocation orchestrators, so the hook payload does not change. [VERIFIED: extensions/pi-claude-marketplace/index.ts:182-186, :383-386]

### F14. The trust check already runs before the body is rendered

`prepareCommand` refuses a project command in an untrusted project before it reads the file (`command-invocation.ts:247-251`), and `invokeBridgedSkill` aborts before `fillSkill` (`skill-invocation.ts:239-241`). Keep the attachment inside `renderCommand` and `fillSkill` and it inherits both gates.

### F15. The command record refuses unknown members

```ts
const STORED_RECORD = Compile(
  Type.Object(
    { pluginRoot: Type.String(), pluginData: Type.String() },
    { additionalProperties: false },
  ),
);
```

[VERIFIED: extensions/pi-claude-marketplace/bridges/commands/command-record.ts:23-28]

A new member must be `Type.Optional(...)` so that a file staged before this phase still validates and keeps its `${CLAUDE_PLUGIN_ROOT}` fill. The reverse case: a release older than this phase reads a new record as "no record". That costs only the two path variables in typed arguments after a downgrade.

## Project Constraints (from AGENTS.md)

- Read a file before editing it; trace a function's callers before changing it.
- Never commit to `main`; never rebase; never use `--no-verify`. Commit by `.agents/skills/committing/SKILL.md`.
- Upstream parity is the default. A divergence needs a recorded decision with an ID or a Pi capability gap. D-PG11-02, D-PG11-03, and D-PG11-06 are the recorded divergences here; no doc may call them parity.
- A user-visible change to `/claude:plugin` behavior ships a cucumber scenario under `features/` that fails without it. Unit tests do not replace it.
- `npm run check` is the only full verdict. GSD gates run it on the combined tree. The commit hook (`npm run check:commit`) is incremental evidence only.
- Every production module has exactly one test at the mirrored path, with 100% line, branch, and function coverage when run alone.
- Two complexity gates: ESLint `sonarjs/cognitive-complexity` 15 and fallow `maxCognitive` 15, `maxCyclomatic` 20. They disagree on scores; satisfy both.
- Output goes through `shared/notification-dispatch.ts` only. No `console`, no `process.stdout`.
- Dependencies are injected as parameters; no test-only seams, no exports made for a test.
- Comments cite decision or requirement IDs (D-PG11-01, PG-SKILL-01), never phase, plan, or wave numbers. No comment on trivial code.
- No new dependency is needed, and none may be added without cause.
- Every plan `SUMMARY.md` has a `## Threat Flags` section.
- Tests run in a hermetic home. No test or probe may read or write the real `~/.pi/agent`.
- Markdown is formatted by mdformat and markdownlint in pre-commit, not by Prettier. `README.es.md` stays in step with `README.md` (the `readme` skill).
- A `CHANGELOG.md` entry follows the `changelog` skill: one bullet of 40 words or fewer for the pull request, written for the reader.

## Architectural Responsibility Map

The extension has no browser or server tiers. The tiers below are its own layers.

| Capability | Primary Tier | Secondary Tier | Rationale |
| --- | --- | --- | --- |
| Find `@` mentions, mask code, parse line ranges, cut to 2,000 lines, render `<file>` blocks | `domain/` | -- | Pure text rules with no I/O (D-PG11-08) |
| `stat` and read the mentioned files, apply the size and text checks | `orchestrators/` | `domain/` for the checks on bytes | The reads sit behind an injected reader in the invocation orchestrators (D-PG11-08) |
| Call the attachment in a typed command and a typed skill | `orchestrators/` (`command-invocation.ts`, `skill-invocation.ts`) | -- | These own what the model receives |
| Compute Claude Code's command name | `domain/name.ts` | -- | Beside `generatedCommandName`, pure |
| Store the name at staging | `bridges/commands/` (`command-record.ts`, `staged-command.ts`) | -- | The bridge writes the staged file and its record |
| Read the name, the description, and the hint into the alias table | `orchestrators/skill-alias-state.ts` | -- | The one session-time reader of staged frontmatter |
| Build the suggestion's `description` text | `edge/skill-aliases.ts` | -- | The edge owns Pi's autocomplete items |
| Compatibility page and record corrections | `docs/`, `.planning/` | -- | Documents |

## Standard Stack

No package is added, removed, or upgraded. The work uses what the repository has.

| Library | Version | Purpose | Notes |
| --- | --- | --- | --- |
| `@earendil-works/pi-coding-agent` | 1.5.0 installed (peer `>=1.5.0`) | `parseFrontmatter`, input events, commands list | Reached only through `platform/pi-api.ts` |
| `@earendil-works/pi-tui` | 1.5.0 installed | `AutocompleteItem` type | `{ value, label, description? }` |
| `typebox` | `^1.1.38` | The command record schema | Add one optional member |
| `node:fs/promises` | Node 26.13.1 here; engines `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` | `stat`, bounded read | Already imported by both invocation orchestrators |
| `@cucumber/cucumber` | repository version | Scenarios | Existing steps cover most needs |

[VERIFIED: node_modules package.json files and package.json, read this session]

## Package Legitimacy Audit

This phase installs no external package, so no audit runs. `@earendil-works/pi-mcp` is named only as evidence for a documentation row; it is Pi's own dependency and is already in `node_modules`.

## Upstream evidence records

### E1. The mention parser of Claude Code 2.1.323

Question: which text is a file mention? Answer, verbatim from the binary (`strings -n 40`, read this session):

```js
// MNt="。、？！", h6=String.raw`[\s${"。、？！"}]`
function z_s(e){let n=new RegExp(String.raw`(^|${h6})@"([^"]+)"`,"g"),r=[],s=qH(e),h;
  while((h=n.exec(s))!==null)if(h[2]&&!h[2].endsWith(" (agent)"))r.push(h[2]);
  let y=R3n(s,!1).filter((k)=>!k.startsWith('"'));return L([...r,...y])}
function R3n(e,n){let r=[];if(!e.includes("@"))return r;
  for(let[s]of e.matchAll(/[^\s]+/g)){let h=s.indexOf("@");
    while(h>0&&!MNt.includes(s[h-1]))h=s.indexOf("@",h+1);
    if(h===-1)continue;let y=n?s.indexOf(":",h+2):h;if(y===-1)continue;
    let k=s.length;while(k>=y+2&&DNt(s,k-1)===DNt(s,k))k--;
    if(k>=y+2)r.push(s.slice(h+1,k))}return r}
function DNt(e,n){let r=e.charCodeAt(n);return r>=48&&r<=57||r>=65&&r<=90||r===95||r>=97&&r<=122}
function sls(e){let n=e.match(/^([^#]+)(?:#L(\d+)(?:-(\d+))?)?(?:#[^#]*)?$/);if(!n)return{filename:e};
  let[,r,s,h]=n,y=s?parseInt(s,10):void 0,k=h?parseInt(h,10):y;return{filename:r??e,lineStart:y,lineEnd:k}}
```

[VERIFIED: Claude Code 2.1.323 binary at `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`]

What the code says, in words:

- **Quoted form:** `@"..."` at the start of the text or after whitespace or one of `。 、 ？ ！`; the value has no `"`; a value that ends ` (agent)` is not a file.
- **Unquoted form:** the text is split on whitespace. In a token, the `@` must be the first character or follow one of the four CJK marks. The path is the rest of the token with its trailing characters outside `[A-Za-z0-9_]` cut. `@a.md,` gives `a.md`; `@dir/` gives `dir`; `@x.c++` gives `x.c`. At least one character must remain.
- **Order:** quoted mentions first, then unquoted, each in text order; `L` removes repeats. D-PG11-05 says "in mention order". Text order is simpler; pick one and pin it in a unit case.
- **Line range:** `#L10` or `#L10-20` after the path; a second `#...` part is ignored. `lineEnd` defaults to `lineStart`.
- **Agent forms:** `@"name (agent)"` is filtered in `z_s`. The `@agent-<name>` filter was not found in `z_s`; it is in a caller that was not traced [CITED: 11-SPIKE-S8.md Q1]. Implement it as D-PG11-04 states it.
- **Path resolution:** `sls`, then a resolver `_t(...)`; a relative path against the session directory and `~` to the home directory, as D-PG11-04 states [CITED: 11-SPIKE-S8.md; the resolver body was not read].

Confidence: high for the syntax (read in code); medium for the agent filter and the resolver.

### E2. The truncation note

Upstream's text for a file over the line limit, verbatim: `` Note: The file ${name} was too large and has been truncated to the first ${N} lines. No need to mention the truncation. Use ${ReadToolName} to read more of the file if you need. `` [VERIFIED: 2.1.323 binary]. For Pi, name Pi's `read` tool. The wording is the agent's discretion (CONTEXT.md).

### E3. Command names, the hint, `bin`, and bundles in the documentation

From `https://code.claude.com/docs/en/plugins-reference.md`, fetched 2026-11-15 [CITED]:

- "In the object map, each key becomes the command name after the plugin prefix. For example, `"about"` in plugin `deploy-tools` runs as `/deploy-tools:about`."
- `argumentHint`: "Argument hint shown after the command name, such as `[file]`".
- Executables: "Files here are on the Bash tool's `PATH` while the plugin is enabled, so Claude runs them as bare commands."
- Hook commands get `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR`, and `CLAUDE_PLUGIN_OPTION_<KEY>` in their process; MCP `stdio` servers get the first three. Neither row lists `PATH`.
- MCP bundle path: "Extracts the `.mcpb` or `.dxt` bundle into `mcpb/` under the plugins root and reads its server config".

### E4. Pi's forms

- The native menu text: `` const fullDesc = hint ? (desc ? `${hint} — ${desc}` : hint) : desc; `` and `description: fullDesc || undefined` [VERIFIED: node_modules/@earendil-works/pi-tui/dist/autocomplete.js:236-242]. The separator is U+2014 between two spaces.
- The menu draws a description on one line: `normalizeToSingleLine(item.description)` [VERIFIED by grep: node_modules/@earendil-works/pi-tui/dist/components/select-list.js:54]. A staged skill description that holds `\n` (the `when_to_use` fold) is safe.
- The file form: `` text += `<file name="${absolutePath}">\n${content}\n</file>\n`; `` after `stripBom(await readFile(absolutePath, "utf-8"))` [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/cli/file-processor.js:59-60].

## Current code

### Typed invocation (PG-SKILL-01)

| Step | Command | Skill |
| --- | --- | --- |
| Edge handler | `edge/command-invocation.ts:121-137` (`send` at `:98-119`) | `edge/skill-aliases.ts:179-217` (`invoke` at `:151-177`) |
| Result to Pi | `finishedTransform` (`edge/input-transform.ts:14-19`) adds U+200B before a text that starts with `/` | the same |
| Locate and trust check | `prepareCommand` (`orchestrators/command-invocation.ts:235-264`) | `invokeBridgedSkill` (`orchestrators/skill-invocation.ts:226-262`) |
| Variables | `commandVariables` (`:156-174`) | `invocationVariables` (`:141-157`) |
| Fill | `renderCommand` (`:204-219`): `substituteArguments` at `:209-214` | `fillSkill` (`:177-207`): `substituteArguments` at `:183-188`, body is `parsed.body.trim()` |
| `!` commands | `expandContextInjections(filled, run)` at `:218` | `:198-205` |
| Final text | `{ kind: "send", text }` at `:218` | `skillBlock(skill, expanded)` at `:206`; the block is built at `:160-165` |
| Dependencies | `CommandInvocationDependencies` (`:78-84`), defaults `:87-97` | `SkillInvocationDependencies` (`:73-79`), defaults `:81-89` |

**Insertion point (D-PG11-02).** In `renderCommand`, before `:209`, compute the variables once and make the variables-only text; scan it. After `:218` returns the expanded text, read the files and append the blocks. In `fillSkill`, the same around `:183` and `:206`, with the blocks inside the skill block (F12).

**Paths that must not attach (D-PG11-07).** `expandStagedCommand` (`command-invocation.ts:290-320`, the `run_plugin_command` tool) and `fillSkillRead` (`skill-invocation.ts:350-398`, the model's read). Both call `substituteArguments` directly and do not go through `renderCommand` or `fillSkill`, so they stay as they are if the attachment lives only in those two functions. A guard unit case in each paired test pins it.

### Command names and aliases (PG-CMD-09)

- `generatedCommandName` (`domain/name.ts:511-536`) elides `<plugin>-` from the first path segment and joins with `commandNamespaceSeparator()`: `:` on POSIX, `.` on Windows.
- `buildStagedCommand` (`bridges/commands/staged-command.ts:268-309`) has `context.pluginName` and `command.sourceName` in hand, builds the record at `:290-293`, and writes it with `withCommandRecord` at `:294-297`. `assertReadsBack` (`:246-258`) compares the whole frontmatter as JSON, so the record's member order must be fixed.
- Aliases: `COMMAND_KIND.names` reads only frontmatter `name` (`orchestrators/skill-alias-state.ts:153-159`). `claimedAliases` (`:262-276`) drops an alias that is in `reserved` or already claimed. `reserved` is every Pi command whose source is not `skill` (`:321-323`), which includes the command's own Pi name. So a stored Claude Code name equal to the Pi name drops out with no comparison in the reader.
- All skills claim before any command (`:330-338`).
- A command alias is rewritten to the Pi name and Pi's own handler chain continues: `commandAliasResult` (`edge/skill-aliases.ts:108-114`), then `registerCommandInvocation` sees `/demo:lint x`.
- For skills, `installedForms` (`skill-alias-state.ts:134-138`) keeps only names under the plugin's own prefix, so a planted record cannot claim another plugin's name (T-02-17). The command reader needs the same check.

**Storage (the discretion of D-PG11-01).** Recommended: an optional string member `claudeName` in the command record under the key `pi-claude-marketplace`. Reasons: `withCommandRecord` replaces any author value under that key (`command-record.ts:39-43`), so a plugin cannot plant a name; the alias reader already parses this frontmatter; and `state.json` needs no schema change. Not recommended: a second frontmatter key (an author could set it unless it gets its own strip), or `state.json` (a schema change for one string).

### Alias suggestions (PG-SKILL-11)

- `appendAliasSuggestions` (`edge/skill-aliases.ts:28-46`) builds `{ value: alias, label: alias }` at `:43` from `aliases.keys()` only (`:70`).
- The colon rule that stays is at `:58-65`.
- `entryNames` (`skill-alias-state.ts:162-176`) parses each staged file's frontmatter and returns names only. The description and the hint are in the same object.
- A staged `SKILL.md` keeps every source frontmatter field except `name` (`bridges/skills/rewrite-frontmatter.ts`), so `argument-hint` survives staging. Its `description` already holds the `when_to_use` fold and the fallback (`bridges/skills/stage.ts:96-140`).
- A staged command always has a `description` (the fallback, D-CF3-08) and has `argument-hint` when the source or the map entry set one (`staged-command.ts:181-198`).
- `argument-hint` is not in `UNHONORED_FIELDS` (`domain/invocation-frontmatter.ts:7-24`), so it joins no dropped-fields warning today, and nothing changes there.
- `PluginAliasTarget` (`skill-alias-state.ts:67-69`) is built in tests of three modules: `test/edge/skill-aliases.test.ts`, `test/orchestrators/skill-alias-state.test.ts`, `test/orchestrators/typed-expansion.test.ts`.

## Architecture Patterns

### Data flow

```text
typed line "/demo:review x"
   |
   v
hooks bridge input handlers (UserPromptSubmit, UserPromptExpansion)   <- unchanged, see the typed line
   |
   v
skill-alias handler --(alias table: names + description + hint)--> rewrite or invoke
   |                                   ^
   |                                   +-- loadPluginNames reads each staged frontmatter once
   v
command or skill invocation orchestrator
   |
   +--> variables --> [A] body with variables only --> domain parser --> mention list
   |
   +--> variables + arguments --> [B] filled body --> ! commands --> [C] rendered body
   |
   +--> mention list --> reader (stat, bounded read) --> domain checks --> <file> blocks
   |
   v
[C] + blocks  (inside <skill> for a skill)  --> finishedTransform --> the model
```

The mention list comes only from [A]. Argument text enters at [B] and `!` output at [C]; neither is scanned.

### Recommended structure

```text
extensions/pi-claude-marketplace/
├── domain/
│   ├── file-mentions.ts            # NEW, pure: mask, mentions, ranges, text checks, block text
│   └── name.ts                     # + the Claude Code command name
├── bridges/commands/
│   ├── command-record.ts           # + optional claudeName
│   └── staged-command.ts           # writes it
├── orchestrators/
│   ├── mention-attachments.ts      # NEW: mention list + reader -> block text
│   ├── command-invocation.ts       # calls it in renderCommand
│   ├── skill-invocation.ts         # calls it in fillSkill
│   └── skill-alias-state.ts        # reads claudeName, description, argument-hint
└── edge/skill-aliases.ts           # description on each suggestion
test/                               # one paired test for each file above
```

One shared orchestrator module keeps the two invocation files from holding the same wiring twice (fallow `dupes` fails on every clone group). Module names are the agent's discretion.

### Pattern 1: scan the variables-only body, read after the shell

```ts
// Source: orchestrators/command-invocation.ts renderCommand, today :204-219. Shape only.
const variables = commandVariables(request, file.frontmatter);
const authored = substituteArguments({
  body: file.body,
  args: undefined, // the variables-only branch, argument-substitution.ts:243-245
  argumentNames: [],
  variables,
});
const mentions = findFileMentions(authored); // domain, pure
const filled = substituteArguments({ body: file.body, args: request.args, argumentNames, variables });
const rendered = await expandContextInjections(filled, run);
const blocks = await attachFileMentions(mentions, { cwd: request.cwd }, dependencies.mentions);
return { kind: "send", text: withFileBlocks(rendered, blocks) };
```

`findFileMentions`, `attachFileMentions`, and `withFileBlocks` are names this research proposes; none exists yet. [ASSUMED names]

### Pattern 2: the mask keeps offsets

Blank a fence or a code span by replacing its characters with spaces of the same count, newlines kept. The token scan then runs on a text of the same length, so mention order and line structure hold, and the body sent to the model is never the masked one. Rules to implement, all from D-PG11-03 and CommonMark's fence shape:

- A fence opens on a line that starts with at most three spaces and then three or more backticks or tildes. It closes on a line of the same character, at least as long. An unclosed fence runs to the end.
- A code span opens with a run of N backticks and closes at the next run of exactly N. An unclosed run masks nothing.
- An indented code block (four spaces) is not masked: the requirement names fenced code and code spans only. Say so in the compatibility page.

### Pattern 3: the stored name is checked again when read

```ts
// Shape only. The reader keeps a stored name only in the form install writes.
const stored = readCommandRecord(frontmatter)?.claudeName;
const identity =
  stored !== undefined && stored.startsWith(`${entry.pluginName}:`) && !/\s/.test(stored)
    ? [stored]
    : [];
return [...identity, ...frontmatterNameAliases(entry.pluginName, frontmatter.name)];
```

The check mirrors `installedForms` for skills. The equal-to-Pi-name case needs no code: `reserved` drops it.

### Pattern 4: required members on the carriers

Give the alias target a required member that may be `undefined`, not an optional one, so that every place that builds a target stops compiling until it decides what to pass. Phase 10 used this for the same reason (10-RESEARCH "Pattern 2").

```ts
// Shape only.
export type PluginAliasTarget =
  | { readonly kind: "skill"; readonly generatedName: string; readonly menu: AliasMenuText }
  | { readonly kind: "command"; readonly name: string; readonly menu: AliasMenuText };
interface AliasMenuText {
  readonly description: string | undefined;
  readonly argumentHint: string | undefined;
}
```

The edge joins the two parts as pi-tui does (E4). Write the separator as `"—"` (see Pitfall 9).

### Anti-Patterns to Avoid

- **Scanning the rendered text.** It is upstream's rule and the one D-PG11-02 rejects: it attaches `/demo:review @/etc/hostname`.
- **Reusing `maskCodeSpans` from `context-injection.ts`.** It leaves `` !`...` `` spans unmasked (F2).
- **A new `_setReaderForTest` seam.** Add the reader to the existing dependencies object of each orchestrator.
- **Reading the plugin source at session time for the command name.** The alias reader never reads the plugin source; the name comes from the staged record.
- **Comparing the stored name with the Pi name in the reader.** `reserved` already does it; a second comparison is a branch with no case.
- **A literal em dash in a `.ts` file or a doc.** The pre-commit hook `fix-unicode-dashes` rewrites it.
- **Rewriting staged files at load.** A command staged before this phase gets its alias at the next restage (APL-D1, D-PG11-01).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
| --- | --- | --- | --- |
| Frontmatter parsing | A line scanner | `parseFrontmatter` from `platform/pi-api.ts` | It is Pi's own parser; the staged files are written to read back through it |
| Variable fill before arguments | A second substitution function | `substituteArguments` with `args: undefined` | The branch exists (`:243-245`) |
| BOM removal on attached text | A regex | `stripBom` (`shared/bom.ts:24`) | Pi strips a BOM in its own file form |
| Record validation | `typeof` chains | The typebox validator in `command-record.ts` | One schema, one reader |
| Alias collisions | A new claim pass | `claimedAliases` and `reserved` | D-PG11-01 says the rules apply unchanged |
| Reading the terminal menu in a scenario | A new step | `the user types the slash command prefix {string} in pi's terminal` and `pi's terminal menu offers these slash commands:` (`features/step_definitions/slash-command/frontmatter.steps.ts:131-152`) | They already split hint and description |
| Writing a fixture file into a plugin | A new step | `the published plugin {string} of the marketplace {string} has the file {string} with this text:` (`features/step_definitions/plugin/publishing.steps.ts:355-360`) | Works for `templates/x.md` and `skills/review/role.md` |
| A Markdown parser for the mask | A new dependency | A small scanner in the domain module | Two constructs only; a dependency is not justified (CLAUDE.md "Simplicity First") |

**Key insight:** almost every part exists. The only new logic is the mention parser with its mask and the qualification checks.

## Runtime State Inventory

This is not a rename phase, but one stored artifact changes shape.

| Category | Items Found | Action Required |
| --- | --- | --- |
| Stored data | Staged command files under `<scopeRoot>/pi-claude-marketplace/resources/prompts/*.md` carry a record with two members. Files staged before this phase have no `claudeName` | None at load (APL-D1). The alias appears after the next restage: update to a new version, reinstall, or disable and enable. The CHANGELOG says so (D-PG11-14) |
| Live service config | None -- the phase touches no service | None |
| OS-registered state | None | None |
| Secrets and env vars | None -- no variable is added or renamed | None |
| Build artifacts | None -- no build step; the plugin name cache is per session and is cleared at `session_start` (`edge/skill-aliases.ts:141-144`) | None |

`state.json` and the completion cache do not change, so no `schemaVersion` moves.

## Common Pitfalls

### Pitfall 1: A `!` command's text is attached

**What goes wrong:** `` !`cat @/abs/x.md` `` attaches `x.md`.
**Why:** the span follows `!`, and the existing mask skips such spans (F2).
**How to avoid:** mask every span and fence in the mention parser. Unit case: an inline `!` span and a ```` ```! ```` fence, each naming an existing file, give no mention.
**Warning sign:** the `!` output scenario passes but a case with the mention inside the command text was never written.

### Pitfall 2: A mention built from an argument placeholder

**What goes wrong:** a body `@$1` or `@${CLAUDE_PROJECT_DIR}/$ARGUMENTS`.
**Why it is safe:** the scan runs before arguments, so the path is the literal `$1`. The argument value never chooses the file.
**How to keep it safe:** a unit case with the body `@$ARGUMENTS`, arguments that name an existing file, and a reader that fails the test if asked for that file.

### Pitfall 3: A file that is not a regular file blocks the read

**What goes wrong:** a mention names a FIFO or a device, and the read never returns.
**How to avoid:** `stat` first and read only when `isFile()` is true (D-PG11-06). The file can grow between the `stat` and the read, so read at most 262,144 bytes plus one and treat more as too large.

### Pitfall 4: The two complexity gates

**What goes wrong:** a single parser function passes ESLint and fails fallow, or the reverse.
**How to avoid:** one small function for each rule: fences, spans, quoted mentions, unquoted tokens, the tail cut, the range. Keep every regular expression linear; `sonarjs` flags a slow one. The upstream expressions in E1 are linear.

### Pitfall 5: A repeat scan with a quadratic cost

**What goes wrong:** masking by repeated `indexOf` from the start, or `replace` inside a loop over mentions. Phase 9 logged this class as UF-09-01.
**How to avoid:** one pass over lines for fences and one pass over the unmasked text for spans.

### Pitfall 6: The skill block no longer parses

**What goes wrong:** blocks after `</skill>` show as the user's message; a block that breaks the `\n</skill>` ending makes Pi show the raw text.
**How to avoid:** F12. The scenario compares the whole model text, so a wrong place fails it.

### Pitfall 7: `assertReadsBack` fails after the record grows

**What goes wrong:** the staged file is refused with "was staged with frontmatter or a body that Pi reads differently".
**Why:** the check compares `JSON.stringify` of the whole frontmatter, so the record written and the record expected must have the same members in the same order.
**How to avoid:** build the record object in one place (`withCommandRecord`) with a fixed order, and omit `claudeName` when it is absent instead of writing `undefined` (`exactOptionalPropertyTypes` is on).

### Pitfall 8: Windows names

**What goes wrong:** a test that expects "no alias when the names are equal" on every platform.
**Why:** on Windows the Pi name is `demo.lint`, so `demo:lint` differs and is an alias (D-PG11-01). The name function must always join with `:` and never call `commandNamespaceSeparator()`.
**How to avoid:** the domain function takes no platform input; the unit test of the alias reader covers both an equal and a different Pi name through `reserved`.

### Pitfall 9: The em dash is rewritten at commit

**What goes wrong:** `` `${hint} — ${desc}` `` in a `.ts` file comes out of the commit with two hyphens, and the alias row no longer matches Pi's native row.
**Why:** `.pre-commit-config.yaml` runs `fix-unicode-dashes` on every file outside `.planning/`.
**How to avoid:** write `"—"`, as `bridges/hooks/hook-labels.ts:53` and `bridges/hooks/context-cap.ts:22` do. In the feature tables the hint and the description are separate columns, so no dash appears there.

### Pitfall 10: A description that reads as a hint in the menu step

**What goes wrong:** the step `hintAndDescription` splits an untagged row at the first dash between spaces (`frontmatter.steps.ts:60-77`). An alias row has no source tag. A fixture description that holds ` - ` or a dash between spaces would be read as hint plus description.
**How to avoid:** keep fixture descriptions free of a spaced dash, as the existing ones are.

### Pitfall 11: A build-input commit that looks like a docs commit

**What goes wrong:** the PG-DOC-02 plan edits two `.ts` comments and one `.feature` description. Those are build inputs, so the hook runs `check:commit` with direct coverage for the staged pairs; a docs-only expectation of a fast commit is wrong.
**How to avoid:** put the comment and feature edits in their own commit, and give the task the pair coverage command in its `<verify>`.

### Pitfall 12: Line citations go stale inside the phase

**What goes wrong:** PG-DOC-01 cites `features/...:<line>`, and an earlier plan of this phase adds scenarios above a cited line.
**How to avoid:** PG-DOC-01 is the last plan; it reads the line numbers from the final tree and runs the citation check in "Validation Architecture".

## Code Examples

### Verbatim in-repo values the plan depends on

The record key and schema, today:

```ts
const RECORD_KEY = "pi-claude-marketplace";
export interface CommandRecord {
  readonly pluginRoot: string;
  readonly pluginData: string;
}
```

[VERIFIED: extensions/pi-claude-marketplace/bridges/commands/command-record.ts:14-20]

The skill record, the model for it:

```ts
const RECORD_SCHEMA = Type.Object({
  names: Type.Array(Type.String()),
  pluginRoot: Type.String(),
  pluginData: Type.String(),
});
```

[VERIFIED: extensions/pi-claude-marketplace/bridges/skills/skill-names.ts:43-47]

The alias target and the command kind, today:

```ts
export type PluginAliasTarget =
  | { readonly kind: "skill"; readonly generatedName: string }
  | { readonly kind: "command"; readonly name: string };
```

```ts
const COMMAND_KIND: AliasKind = {
  source: "prompt",
  resources: (record) => record.prompts ?? [],
  stagedFile: (root, name) =>
    path.join(root, "pi-claude-marketplace", "resources", "prompts", `${name}.md`),
  names: (entry, frontmatter) => frontmatterNameAliases(entry.pluginName, frontmatter.name),
};
```

[VERIFIED: extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts:67-69, :153-159]

The suggestion item, today:

```ts
items: [...nativeItems, ...matches.map((alias) => ({ value: alias, label: alias }))],
```

[VERIFIED: extensions/pi-claude-marketplace/edge/skill-aliases.ts:43]

Pi's skill block, which the extension copies:

```ts
`<skill name="${skill.name}" location="${skill.location}">\n` +
`References are relative to ${skill.baseDir}.\n\n${body}\n</skill>`
```

[VERIFIED: extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts:160-165]

### The Claude Code command name, shape only

```ts
// domain/name.ts, beside generatedCommandName. Always ':' (D-PG11-01), never elided.
export function claudeCommandName(plugin: string, source: string): string {
  return [plugin, ...source.split("/")].join(":");
}
```

`claudeCommandName` is a proposed name [ASSUMED]. `source` is `DiscoveredCommand.sourceName`.

### Scenario steps the new scenarios reuse

All of these exist [VERIFIED: features/ read this session]:

```gherkin
Given pi runs with the scripted model
Given the marketplace "fixtures" is published as a dir source
Given the marketplace "fixtures" offers these plugins:
Given the published plugin "demo" of the marketplace "fixtures" has the slash command "review" with this command file:
Given the published plugin "demo" of the marketplace "fixtures" has the skill "review" with this skill file:
Given the published plugin "demo" of the marketplace "fixtures" has the file "templates/x.md" with this text:
Given the marketplace "fixtures" is added to the project scope
Given the user has run "/claude:plugin install demo@fixtures --scope project"
Given the user has started a new pi session
Given the scripted model plays these steps:
When the user prompts "/demo:review"
Then the model receives these calls:
When the user types the slash command prefix "/demo:fa" in pi's terminal
Then pi's terminal menu offers these slash commands:
```

Facts the scenarios can rely on:

- A dir-source plugin's root is `{home}/marketplaces/fixtures/plugins/demo` (`features/slash-command/invocation.feature:111`), so the attached file's name is `{home}/marketplaces/fixtures/plugins/demo/templates/x.md`.
- `the user prompts {string}` expands `{home}` and `{project dir}` in the typed text (`features/step_definitions/session.steps.ts:98-99`). So the argument scenario can type the path of a file that exists in the scenario's world, the same template file, with no real `/etc/hostname`: `/demo:review @{home}/marketplaces/fixtures/plugins/demo/templates/x.md` against a body `Review $ARGUMENTS`. That is a stronger guard than a missing path, because a scan of the rendered text would attach it.
- `the model receives these calls:` projects the tokens back and compares the whole text (`features/step_definitions/model.steps.ts:135-143`), `\n` written as `\n` in the cell.
- Staging copies the whole skill folder (`bridges/skills/stage.ts:329-330`), so a skill body `@${CLAUDE_SKILL_DIR}/role.md` with the file `skills/review/role.md` names `{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-review/role.md`.

No new step is needed. A new terminal-menu scenario in `features/skill/aliases.feature` uses the two menu steps as they are; their text says "slash commands", which a skill alias is in Pi's menu. If the writer wants a step that says "skill alias", it belongs in `features/step_definitions/skill/aliases.steps.ts` and needs a second use of the shared reader in `features/lib/`; that is more work than the reuse and is not needed.

## PG-DOC-02: the eight rows

Each row gives the current place, the corrected statement, its source, and whether it is measured. Line numbers were read on 2026-11-15 at commit `e653ef4c`.

| # | Where now | Corrected statement | Source and version | Measured? |
| --- | --- | --- | --- | --- |
| 1a | `docs/research/claude-hooks-vs-pi-events.md:7` ("Pi has 31 extension events"); the table's last row at `:116` is number 31 | Pi 1.5.0 and 1.5.2 have 41 extension events | Pi 1.5.0 `dist/core/extensions/types.d.ts:1210-1250`, counted this session; 1.5.2 by the hooks report | Read in code |
| 1b | Same file `:12`, `:13`, and the repeats at `:308`, `:311`, `:323`, `:385`, `:386`, `:592`, `:593` | The official marketplace uses nine distinct events. `claude-security` uses `PermissionRequest`, which is not supported, and `UserPromptExpansion`, which is supported since D-PG6-18 | `docs/research/parity-gaps/hooks.md:86` (seven `hooks.json` files parsed, 2026-11-11); `hook-events.ts:51-63` | Marketplace audit by the report; not repeated here. See F6 |
| 2 | `docs/mcp-compatibility.md:98` (table row) and `:811` (the divergence bullet; the PRD's `:636` moved); `.planning/BACKLOG.md:4934-4936` (TOOLSEARCHOFF-01) | Under Pi's built-in MCP with `tool_search` off, a `codemode` script can still call a plugin tool, when `codemode` is on. Pi turns `codemode` on only for a server with `codemode` exposure; this extension registers plugin servers as deferred, so the user must turn `codemode` on | Pi 1.5.0 `docs/mcp.md:228` and `:206`, read this session | **Unmeasured**: no scenario calls a plugin tool from a codemode script |
| 3 | `docs/mcp-compatibility.md:359` (the PRD's `:331` moved) and `:87`; `.planning/BACKLOG.md:4606-4608` (MCPB-01, "Trigger: pi-mcp-adapter adds a bundle runner"); `domain/mcp-resolution.ts:75-76`; `features/mcp-server/sources.feature:405-406` | Claude Code has no bundle runner either. It unpacks the bundle and reads a normal server config from it. What blocks bundles here is project work: an unpack step and a manifest translation, bundle `user_config` included | Claude Code docs `plugins-reference.md`, "MCP bundle path", fetched 2026-11-15; `docs/research/parity-gaps/mcp.md:389`, `:412` | Read in docs |
| 4 | `docs/mcp-compatibility.md`, 31 lines that name `dist/extensions/mcp/...`; the version statement at `:9-11` and the source note at `:170`; two code comments (F9) | These paths are right for Pi 1.5.0, the floor and the installed copy. Since Pi 1.5.1 the tool naming, the config validation, and the OAuth sign-in are in `@earendil-works/pi-mcp`: `dist/naming.js`, `dist/config.js`, `dist/oauth/` | Installed Pi 1.5.0 tree; `@earendil-works/pi-mcp@1.5.2` file list from the npm registry, this session; the 1.5.1 date by `mcp.md:24` | Read in code |
| 5 | `.planning/BACKLOG.md:3829-3831` (WOUT-01); `.planning/ROADMAP.md:580` | Already corrected by Phase 8. Fix the heading, which still says the subagents declined every tool call. A workflow subagent gets `read`, `bash`, `edit`, and `write` | `features/workflow/agent-steps.feature:96` on engine 3.15.0 (two subagents run `bash`, `:121-126`); "since 3.13.1" from the engine source by `workflows.md:208` | **Measured** at 3.15.0. The 3.13.1 boundary is read in code. Output quality on a real plugin stays unmeasured |
| 6 | `docs/env-vars.md:122` (Hooks table, Claude Code column `✓`), `:161` (MCP spawn env table, `✓`), `:28` (matrix row, one `✓` for Claude Code with Pi cells `E`, `E`, `E‡`), and the rule text at `:180`; `:60` (Bash children) is right | Claude Code 2.1.323 puts a plugin's `bin` on the `PATH` of the Bash and PowerShell tools only. Hooks and MCP servers do not get it. Pi appends it to the process `PATH`, so hooks and MCP servers inherit it: more than upstream, a recorded divergence whose change is deferred (core report N5) | 11-SPIKE-S8.md Q5 (binary 2.1.323, two consumers of `getEnabledPluginBinPaths`); Claude Code docs, "Executables" row | Read in the binary, not run |
| 7 | `.planning/BACKLOG.md:5-25` (UAT-02), the last paragraph included | Pi rebuilds the chat before `session_start` on `/reload`: `handleReloadCommand` passes `beforeSessionStart: restoreChatBeforeSessionStart`. So a notification sent during the reload is not erased by the rebuild | Pi 1.5.0 `dist/modes/interactive/interactive-mode.js:5468-5479`, read this session; "since 0.79.10" by `docs/research/parity-gaps/core.md:156`, `:395` | **Unmeasured**: read in code, not run in a live terminal. No scenario reads a notice after a terminal `/reload` |
| 8 | `docs/prd/pi-claude-marketplace-prd.md:118` (section 3, Glossary, "Component") | Hooks and workflows are supported components, hooks in part (the hooks compatibility page) and workflows with a soft dependency on `@quintinshaw/pi-dynamic-workflows`. `userConfig` is supported for defaults (PG-CORE-03) | README component list (`README.md:28-30`); Phases 6, 8, and 10 | Current product state |

Notes for the planner:

- Row 8 names only the "Component" entry. Lines `:92` and `:1066` of the same document repeat the claim; correcting them is outside the requirement's text, and the deferred list in CONTEXT.md keeps other stale records out. Leave them, or ask.
- Row 1 is a dated research note. Add a dated amendment and correct the lines; do not rewrite the audit.
- Row 6: the matrix at `:28` has one Claude Code cell for all surfaces. A footnote mark on the Hooks and MCP env cells is the smallest correct change.
- Rows 2, 3, and 5 each have a BACKLOG entry. Keep the entry and correct its premise and trigger; do not close it.
- Every corrected line names its source and version, in the document's own register ("read in its binary and not run").

## PG-DOC-01: status table map

The starting table is `docs/research/parity-gaps/skills-commands.md:143-173`. The map below gives one scenario for each row, at commit `e653ef4c`. Plans of this phase add scenarios, so PG-DOC-01 reads the final line numbers itself (Pitfall 12). `SC` stands for `features/slash-command`, `SK` for `features/skill`.

| Behavior | Scenario citations |
| --- | --- |
| Skill listing name | `SK/listing.feature:6`; directory name over frontmatter name `SK/frontmatter.feature:307` |
| Skill aliases, typed | `SK/aliases.feature:14`, `:117`, `:101`; over RPC `SK/invocation.feature:230` |
| Skill aliases, terminal menu | `SK/aliases.feature:218`; the new PG-SKILL-11 scenario |
| Command listing, nested, elision | `SC/listing.feature:7`, `:95`, `:116`; dotfile skip `:137` |
| Command aliases from frontmatter `name` | `SC/aliases.feature:13`, `:41`, `:72`, `:103` |
| Command alias from Claude Code's name | the new PG-CMD-09 scenario |
| Typed arguments | `SC/invocation.feature:7`, `:28`; `SK/invocation.feature:8`, `:117` |
| `!` injection | `SC/invocation.feature:153`, `:174`, `:263`, `:289`, `:310`; `SK/invocation.feature:54`, `:75`, `:276`, `:302`, `:323` |
| An argument cannot form a `!` command | `SC/invocation.feature:195`; `SK/invocation.feature:96` |
| `${CLAUDE_PLUGIN_ROOT}`, `_DATA`, `_SKILL_DIR` | `SC/invocation.feature:88`; `SK/invocation.feature:178` |
| `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}` | `SC/invocation.feature:63`; `SK/invocation.feature:152` |
| `${CLAUDE_PROJECT_DIR}` at user scope | `SC/invocation.feature:113`; `SK/invocation.feature:204`; `SK/model-reads.feature:43`; `SC/model-runs.feature:79` |
| `${user_config.KEY}` | `SK/options.feature:7`, `:51`, `:77`; `SC/options.feature:7` |
| `@file` attachment and its three exclusions | the new PG-SKILL-01 scenarios |
| Description fallback, `when_to_use` | `SK/listing.feature:23`, `:45`, `:73`; `SC/listing.feature:25`, `:45`, `:74` |
| `argument-hint` | commands `SC/frontmatter.feature:167`, `SC/manifest-forms.feature:730`; skills: the new PG-SKILL-11 scenario |
| `disable-model-invocation` | `SK/frontmatter.feature:210`, `:234`; `SC/model-runs.feature:103` |
| `user-invocable: false` | `SK/frontmatter.feature:265`, `:284`; `SC/frontmatter.feature:90`, `:113` |
| Dropped fields warning | `SK/frontmatter.feature:12`, `:34`; `SC/frontmatter.feature:6`, `:31`; `SC/manifest-forms.feature:699` |
| Fields with no warning (`allowed-tools` and others) | `SK/frontmatter.feature:62`; `SC/frontmatter.feature:62` |
| The skill-read fill | `SK/model-reads.feature:27`, `:68`, `:84`, `:100`, `:122` |
| `run_plugin_command` | `SC/model-runs.feature:22`, `:63`, `:103`, `:128`; `SC/frontmatter.feature:139` |
| Manifest `commands` forms | `SC/manifest-forms.feature:7`, `:33`, `:106`, `:194`, `:265`, `:345`, `:624`, `:672` |
| Manifest `skills`, root-source entries | `SK/root-source-entries.feature:28`; `SK/collisions.feature:102`, `:128` |
| Sibling skill links | `SK/sibling-links.feature:7`, `:40`, `:88` |
| Malformed frontmatter | `SK/frontmatter.feature:85`, `:189`; `SC/listing.feature:74` |
| A command and a skill with one name | `SK/collisions.feature:13`, `:36`, `:56` |
| A body that starts with `/` (zero-width space) | `SC/invocation.feature:238`; `SK/invocation.feature:251` |
| Lifecycle | `SK/lifecycle.feature:19`, `:36`, `:45`, `:62`, `:82`; `SC/lifecycle.feature:20`, `:37`, `:46`, `:52`, `:70` |
| A removed file before `/reload` | `SC/invocation.feature:216`; `SK/lifecycle.feature:50` |
| Project trust, skills | `SK/project-trust.feature:27`, `:31`, `:41`, `:51`, `:73` |
| Workflow names in bodies | `features/workflow/references.feature:16`, `:33` |

**Not proven by a scenario** (found by title search; PG-DOC-01 lists them apart from the table, D-PG11-12):

- The `.` separator of a command name on Windows (unit tests only; the harness does not run on Windows).
- The 1,536-character cap on a listed description.
- A symbolic link as a skill folder is refused.
- A `SKILL.md` at the plugin root with no declaration is not discovered.
- A `SKILL.md` inside `commands/` is staged as a command (BACKLOG CMDSKILLMD-01).
- The rewrite of `plugin:skill` tokens in a body to Pi names (SKTK-01). `features/workflow/references.feature` covers workflow names only.
- A project command refused in an untrusted project. The skills have `project-trust.feature`; no command scenario has that title. The code path is `command-invocation.ts:247-251`.
- This phase's unit-only rules: the size limit, the 2,000-line cut, a binary file, a directory, a symbolic link, the line range, the quoted form, the CJK marks, `~`, and a relative path.
- Mentions on the `run_plugin_command` path and the skill-read fill: not attached, by D-PG11-07. A scenario would be a guard; none is required.

The planner may turn any of these into a scenario, but none is needed for the requirement: D-PG11-12 puts an unproven behavior in the separate list.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
| --- | --- | --- | --- |
| A command or skill body reaches the model as a static template | The `input` transform fills arguments, variables, and `!` output | component-features (D-CF1-01, D-CF1-02) | The attachment joins this transform |
| `${CLAUDE_PROJECT_DIR}` literal at user scope | Filled at invocation | Phase 10 (D-PG10-16) | The scan sees the filled path |
| `${user_config.KEY}` literal | Written at staging | Phase 10 (D-PG10-13) | An option default can be part of a mention path; it is the author's text |
| No `UserPromptExpansion` | The event runs before the expansion | Phase 6 (D-PG6-18) | The hook sees the typed line, not the attached text |
| Command aliases from frontmatter `name` only | Plus Claude Code's own name | this phase (D-PG11-01) | Amends D-141-01 |

**Out of date in the records:** the skills report's rows for `${CLAUDE_PROJECT_DIR}` and `${user_config.*}` (`skills-commands.md:153-154`) describe the state before Phase 10. PG-DOC-01 must write the current state, not copy those rows.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
| --- | --- | --- | --- |
| A1 | Reading the files after the `!` commands is acceptable under D-PG11-02 | F3 | Low: the mention list is the same; only the read time moves |
| A2 | `String()` for a non-string `argument-hint`, a mapping left out | F4 | Low: display text only |
| A3 | Text order for the `<file>` blocks, where upstream puts quoted mentions first | E1 | Low: order of blocks only; D-PG11-05 says "mention order" |
| A4 | The module and function names proposed here (`file-mentions.ts`, `mention-attachments.ts`, `claudeCommandName`, `claudeName`) | Architecture Patterns | None: the agent's discretion |
| A5 | Upstream filters `@agent-<name>` in a caller of `z_s` | E1 | Low: D-PG11-04 fixes the behavior either way |
| A6 | Upstream follows a symbolic link when it reads a mention | D-PG11-06 (from S8) | Low: recorded as unverified in the spike |
| A7 | The corrected hooks statement keeps the report's count of nine events without a new audit of the marketplace | PG-DOC-02 row 1b | Low: the doc names the audit date |
| A8 | Lines `:92` and `:1066` of the first PRD stay as they are | PG-DOC-02 notes | Low: a reader may still meet the old claim there |

## Open Questions

1. **Should `command_name` in `UserPromptExpansion` become Claude Code's name for a command?**
   - What we know: D-PG6-19 records "the Pi name for a bridged command". After this phase the Claude Code name is stored, so the hook could get `demo:demo-lint`, as upstream sends.
   - What is unclear: whether the maintainer wants D-PG6-19 amended in this phase.
   - Recommendation: do not change it here. Record a BACKLOG entry that names the stored name as the enabler, and state the difference in the compatibility page.

2. **A frontmatter `name` on a nested command.**
   - What we know: the 2.1.323 command builder holds `Ft=e.slice(0,e.lastIndexOf(":")+1)` and then `` `${Ft}${ln}` ``, which reads as "replace the last segment", so `commands/build/web.md` with `name: x` would be `plugin:build:x`. This extension gives `plugin:x` (`frontmatterNameAliases`).
   - What is unclear: `e` was not traced, so this is a reading of one fragment.
   - Recommendation: out of scope. Put it in the "Not proven" list of PG-DOC-01 or in BACKLOG as unverified.

3. **Does a directory mention deserve a notice?**
   - What we know: D-PG11-06 says no notice; upstream attaches a listing.
   - Recommendation: follow D-PG11-06. The compatibility page states it as a deferred difference.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
| --- | --- | --- | --- | --- |
| Node | everything | yes | v26.13.1 | -- |
| npm | checks | yes | 11.20.0 | -- |
| Python 3 | the terminal-menu scenarios (`features/lib/pi-tui-pty.py`) | yes | 3.15.2 | -- |
| Optional peers cache | `npm run test:cucumber` | yes | pi-mcp-adapter 7.0.1, pi-subagents 0.88.1, pi-dynamic-workflows 3.15.0 | `scripts/install-test-peers.mjs` reinstalls |
| Claude Code binary | evidence only | yes | 2.1.323 | the spike record |
| A live Claude Code session | none of the work | not used | -- | claims that need one are marked unmeasured |

**Missing dependencies with no fallback:** none.

Node 26 appends the path to some `fs` error messages and Node 24 does not. A scenario or test that pins an errno message must read it back from the runtime. The attachment adds no message, so this matters only if a new refusal text is added.

## Validation Architecture

### Test Framework

| Property | Value |
| --- | --- |
| Unit | `node:test` with `node:assert/strict`, `strong-mock` for strict mocks |
| Behavioral | `@cucumber/cucumber`, profiles `adapter` and `builtin` in `cucumber.json` |
| Quick run, one test module | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <test-path>` |
| One pair's coverage | `npm run test:coverage:direct -- <source path>` |
| One feature file | `npm run test:cucumber:profile -- --profile adapter <paths>` |
| Scenarios by title | `npx cucumber-js --profile adapter --name "<text>" <paths>` |
| Feature gate | `npm run check:features` |
| Full suite | `npm run check` |

None of the new scenarios is an MCP scenario, so none carries an implementation tag, and each runs once, under the adapter profile.

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
| --- | --- | --- | --- | --- |
| PG-CMD-09 | `/demo:demo-lint x` sends the body of `commands/demo-lint.md` | cucumber, red first | `npx cucumber-js --profile adapter --name "(PG-CMD-09)" features/slash-command/aliases.feature` | file yes, scenario new |
| PG-CMD-09 | The name function: flat, nested, map key, always `:` | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/name.test.ts` | yes |
| PG-CMD-09 | The record round trip, an old record still read, a planted name dropped | unit | `... --test test/bridges/commands/command-record.test.ts test/bridges/commands/staged-command.test.ts test/orchestrators/skill-alias-state.test.ts` | yes |
| PG-SKILL-11 | A command alias row shows its description | cucumber, red by edit | `npm run test:cucumber:profile -- --profile adapter features/slash-command/aliases.feature features/slash-command/frontmatter.feature` | yes (rows at `aliases.feature:118`, `frontmatter.feature:196` change) |
| PG-SKILL-11 | A skill alias row shows `argument-hint` and description | cucumber, red first | `npx cucumber-js --profile adapter --name "(PG-SKILL-11)" features/skill/aliases.feature` | file yes, scenario new |
| PG-SKILL-11 | Hint only, description only, both, neither; a list hint | unit | `... --test test/edge/skill-aliases.test.ts test/orchestrators/skill-alias-state.test.ts` | yes |
| PG-SKILL-01 | A body mention reaches the model in a `<file>` block (command) | cucumber, red first | `npx cucumber-js --profile adapter --name "(PG-SKILL-01)" features/slash-command/invocation.feature` | file yes, scenario new |
| PG-SKILL-01 | A typed argument that names an existing file is not attached | cucumber, guard | same command | scenario new |
| PG-SKILL-01 | A mention in a fence, in a code span, and in `!` output is not attached | cucumber, guard (an Outline of three rows fits) | same command | scenario new |
| PG-SKILL-01 | A skill body mention is attached through an alias | cucumber, red first | `npx cucumber-js --profile adapter --name "(PG-SKILL-01)" features/skill/invocation.feature` | file yes, scenario new |
| PG-SKILL-01 | Parser: quoted, unquoted, CJK marks, tail cut, line range, agent forms, fences, spans, repeats | unit | `... --test test/domain/file-mentions.test.ts` | Wave 0 |
| PG-SKILL-01 | Qualification: missing, directory, too large, NUL byte, 2,000-line cut, symbolic link, `~`, relative path | unit, real files in a temporary directory for the link case | `... --test test/orchestrators/mention-attachments.test.ts` | Wave 0 |
| PG-SKILL-01 | `run_plugin_command` and the skill-read fill do not attach | unit guard | `... --test test/orchestrators/command-invocation.test.ts test/orchestrators/skill-invocation.test.ts` | yes |
| PG-DOC-01 | Each cited line is a `Scenario` line | script | the citation check below | page new |
| PG-DOC-01 | Each cited scenario passes | suite | `npm run test:cucumber` on the combined tree (part of `npm run check`) | -- |
| PG-DOC-02 | The old statements are gone | grep | the grep checks below | -- |

The citation check, tested this session on sample files (a good file exits 0; a file that cites a non-scenario line prints `BAD` and exits 1):

```bash
grep -o 'features/[a-z-]*/[a-z-]*\.feature:[0-9]*' docs/skills-commands-compatibility.md | sort -u |
  while IFS=: read -r f n; do
    sed -n "${n}p" "$f" | grep -q '^ *Scenario' || { echo "BAD $f:$n"; exit 1; }
  done
```

It needs at least one citation to mean anything: add `grep -c 'features/.*\.feature:[0-9]' docs/skills-commands-compatibility.md` and require a count above zero. A filter that matches nothing is a green run that checked nothing.

Grep checks for PG-DOC-02, each expected to print nothing:

```bash
grep -n "Pi has 31 extension events" docs/research/claude-hooks-vs-pi-events.md
grep -n "the model cannot reach the plugin tools" docs/mcp-compatibility.md
grep -n "has a bundle runner" docs/mcp-compatibility.md features/mcp-server/sources.feature
grep -n "has no bundle runner" extensions/pi-claude-marketplace/domain/mcp-resolution.ts
```

A grep proves a removal, not a correct replacement; the plan's acceptance criteria state the new text for each row.

Cucumber title filters: `--name` with a filter that matches nothing prints `0 scenarios` and exits 0. Each `<fails_when>` must name the expected count, as Phase 10's plans do.

### Sampling Rate

- **Per task commit:** the owner test, the pair coverage, and the feature file the task touches; `npm run check:features` when a feature or step file changed. The commit hook runs `check:commit`.
- **Per wave merge:** `npm run check` on the combined tree.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `test/domain/file-mentions.test.ts` -- with its source, covers the PG-SKILL-01 parser
- [ ] `test/orchestrators/mention-attachments.test.ts` -- with its source, covers the reads and the qualification
- No framework install and no shared fixture is missing. Each new source file lands with its test in the same commit (`test:corresponding` fails otherwise).

### Red and guard summary

Red without the change: the PG-CMD-09 alias scenario, the two edited menu rows and the new skill menu scenario, the command attachment scenario, the skill attachment scenario. Guards that pass before and after, and fail under the plausible wrong implementation (a scan of the rendered text, or no mask): the argument scenario, the fence, code span, and `!` output rows.

## Recommended plan split

Sequential, one worktree, one plan per wave. The three code areas share `skill-alias-state.ts` and the two invocation files, so no two of these plans can run side by side.

| Wave | Plan | Content | Requirement |
| --- | --- | --- | --- |
| 1 | 11-01 | Claude Code's command name: the domain function, the record member, the staging write, the alias reader, the `/demo:demo-lint x` scenario, the README name-mapping text in both languages | PG-CMD-09 |
| 2 | 11-02 | Alias suggestions: description and hint in the name table, the suggestion text, the two edited rows, the new skill menu scenario | PG-SKILL-11 |
| 3 | 11-03 | The pure mention parser with its mask, ranges, checks on bytes, and block text; unit tests only | PG-SKILL-01 |
| 4 | 11-04 | The attachment orchestrator and its wiring into the command invocation; the command scenarios (attached, argument, fence, code span, `!` output) | PG-SKILL-01 |
| 5 | 11-05 | The wiring into the skill invocation, blocks inside the skill block; the skill scenario through an alias; the guard cases for the two model paths | PG-SKILL-01 |
| 6 | 11-06 | The eight corrections of PG-DOC-02, the two code comments, the bundle comment, the scenario description | PG-DOC-02 |
| 7 | 11-07 | Records of D-PG11-14: `PROJECT.md` rows D-PG11-01, -02, -03, the amendment on D-141-01, the S8 cell of the PRD's section 9 (`docs/prd/parity-gaps-prd.md:957`), the CHANGELOG bullet with the restage note | D-PG11-14 |
| 8 | 11-08 | `docs/skills-commands-compatibility.md`, the README link in both languages, the citation check, the full gate | PG-DOC-01 |

Plans 11-04 and 11-05 can be one plan if the planner's size rule allows; they are split here because each touches one orchestrator, one paired test, and one feature file. Plans 11-06 and 11-07 edit planning documents that GSD state commands also write, so they run in order, never beside another plan.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
| --- | --- | --- |
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | yes | Pi has no read permission rules, so only author-written mentions are read (D-PG11-02); the project trust gate runs first (F14) |
| V5 Input Validation | yes | The mention parser; the stored name checked against the plugin prefix when read (Pattern 3); the typebox record schema |
| V6 Cryptography | no | -- |
| V12 Files and Resources | yes | `stat` before read, regular files only, a 262,144-byte limit, a bounded read, a NUL-byte text check |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
| --- | --- | --- |
| A typed or forwarded argument names a file to read (`/demo:review @~/.ssh/id_rsa`) | Information disclosure | The scan runs on the body before arguments (D-PG11-02); a scenario and a unit case guard it |
| `!` output names a file | Information disclosure | The scan runs before the commands; the output is never scanned |
| A `!` command's own text holds a mention | Information disclosure | Mask every code span and fence (F2) |
| An argument placeholder inside a mention (`@$1`) | Tampering | The path is the literal placeholder (Pitfall 2) |
| A plugin author mentions a private file of the user | Information disclosure | Accepted: the author can already run `!` commands (D-CF1-02, D-PG11-08). No new power; state it in the compatibility page |
| A planted `claudeName` in a source file's frontmatter | Spoofing | `withCommandRecord` replaces the whole record key; the reader keeps only a name under the plugin's own prefix |
| A stored name that takes another command's or a built-in's name | Spoofing | `reserved` and first-claim-wins in `claimedAliases`, unchanged |
| A FIFO, a device, or a growing file as a mention | Denial of service | Regular files only, bounded read (Pitfall 3) |
| An attached file that holds `</file>` or `</skill>` | Tampering | Not mitigated; Pi's own `<file>` form has the same property. Record it as accepted in the plan's threat model |
| A slow scan on a hostile body | Denial of service | Linear passes and linear expressions (Pitfalls 4 and 5); the 4,000,000-character invocation limit still applies to the body |
| A project-scope plugin in an untrusted project | Elevation of privilege | The existing refusal runs before any read (F14) |

The attachment reads files but writes none, so NFR-1 (atomic writes) and NFR-10 (write containment) do not apply. NFR-5 holds: no network.

## Sources

### Primary (HIGH confidence)

- The repository at commit `e653ef4c`: the source, test, feature, and document files cited with line numbers above, read this session.
- `node_modules/@earendil-works/pi-coding-agent` 1.5.0 and `pi-tui` 1.5.0: `dist/cli/file-processor.js`, `dist/core/agent-session.js`, `dist/core/extensions/types.d.ts`, `dist/modes/interactive/interactive-mode.js`, `docs/mcp.md`, `dist/autocomplete.js`.
- The Claude Code 2.1.323 binary: `z_s`, `R3n`, `DNt`, `sls`, the `argument-hint` reads, the truncation note. Read from extracted strings; nothing was run.
- The npm registry file list of `@earendil-works/pi-mcp@1.5.2`.

### Secondary (MEDIUM confidence)

- `https://code.claude.com/docs/en/plugins-reference.md`, fetched 2026-11-15.
- `.planning/phases/11-skills-commands-and-records/11-SPIKE-S8.md` for the facts this session did not re-read (the two consumers of `getEnabledPluginBinPaths`, the Read deny gate, the directory listing).
- The parity reports under `docs/research/parity-gaps/` (2026-11-11) for the marketplace audit, the Pi 1.5.1 move, the engine 3.13.1 boundary, and the Pi 0.79.10 reload fix.

### Tertiary (LOW confidence)

- The reading of the nested-command `name` fragment in Open Question 2.

### Tooling notes

- No search provider is configured (`brave_search`, `exa_search`, `firecrawl` are off), and the knowledge graph is disabled, so the research used the code, the binary, one documentation fetch, and one registry query.
- A `.{600}` prefix in a grep over the 69 MB strings file runs for minutes; `awk` with `index()` and `substr()` answers at once.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- no package changes; versions read from `node_modules`.
- Architecture: HIGH -- every insertion point was read with its callers.
- Upstream mention syntax: HIGH -- read in the 2.1.323 code; MEDIUM for the agent filter and the path resolver.
- PG-DOC-02 rows: HIGH for the current lines; the measured or unmeasured mark is stated for each row.
- Pitfalls: HIGH -- each comes from code read this session or from a gate in the repository.

**Research date:** 2026-11-15
**Valid until:** 2026-12-15 for the code map (line numbers move with each plan of this phase); the upstream facts are pinned to Claude Code 2.1.323 and Pi 1.5.0.
