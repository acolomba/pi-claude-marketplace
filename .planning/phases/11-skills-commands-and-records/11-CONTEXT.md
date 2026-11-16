# Phase 11: Skills, Commands, and Records - Context

**Gathered:** 2026-11-15
**Status:** Ready for planning
**Mode:** autonomous discuss (`--auto`; the user told this run to proceed
without asking). Every gray area took its upstream-parity answer where the
locked requirements allow one. Decision 13 of the PRD's section 5.2 is a
maintainer decision; this run answered it and marks it **pending maintainer
review**. Spike S8 ran from the binary and the docs only (no live session);
its findings are in `11-SPIKE-S8.md`, and three of them show that the locked
text of PG-SKILL-01 is stricter than Claude Code. Those divergences are
recorded below with their license and are also pending maintainer review.

<domain>
## Phase Boundary

Deliver PG-SKILL-01, PG-CMD-09, PG-SKILL-11, PG-DOC-01, and PG-DOC-02, against
Pi 1.5.0 (the peer floor and the installed dev copy) and Claude Code 2.1.323
(the installed binary):

- A typed bridged command or skill attaches the existing regular text files
  that its author's `@path` references name, in Pi's `<file>` form. A `@path`
  that arrives through an argument or through `!` output, or that sits in
  fenced code or a code span, is not attached (PG-SKILL-01).
- A command answers to Claude Code's name `/<plugin>:<path>:<file>` when that
  name differs from its Pi name (PG-CMD-09).
- Each alias suggestion shows its target's description and, for a skill, its
  `argument-hint` (PG-SKILL-11).
- `docs/skills-commands-compatibility.md` exists, and each row of its status
  table cites a passing scenario (PG-DOC-01). It is the last work.
- The eight records of the PRD's section 10 marked "none" are corrected
  (PG-DOC-02).

Not in scope: attaching on the model paths (`run_plugin_command` and the
skill-read fill); directory references; narrowing the plugin `bin` to the bash
tool (core report N5); the other stale records in the skills report's "Wrong
or stale project documentation" list that PG-DOC-02 does not name; the S8
questions that gate MCP-03, SKILL-06, and decision 26.

</domain>

<decisions>
## Implementation Decisions

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
  - **Frontmatter `name` (code review WR-01, 2026-11-15):** when a command
    sets a frontmatter `name`, Claude Code 2.1.323 replaces the path name with
    it (`dBt` reads any present value with `String()` and ignores an empty or
    over-256-character result; the builder then uses `Zt`, never the path name
    `e`). So the path name is no alias then: `demo/commands/demo-ship.md` with
    `name: fancy` does not answer to `/demo:demo-ship`. The alias reader drops
    the stored name in that case (`declaresFrontmatterName`), so a command
    staged earlier in this phase follows the rule with no restage.
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
  skip, or follow upstream and change criterion 2. A code span is one that
  CommonMark finds (code review WR-02, 2026-11-15): a backslash-escaped
  backtick opens none, and none crosses a blank line, a list item, an ATX
  heading, or the start of a blockquote, so a mention outside a real span
  stays attached as D-PG11-04 requires.
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

### the agent's Discretion

Where the Claude Code command name is stored at stage time; the text test of
D-PG11-06; the truncation note wording; module placement and names; scenario
wording and splits; plan splits. No exception to plan size, security,
coverage, or verification gates.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` -- Phase 11 section (goal, discuss order, spike,
  notes, success criteria)
- `.planning/REQUIREMENTS.md` -- PG-SKILL-01, PG-CMD-09, PG-SKILL-11,
  PG-DOC-01, PG-DOC-02
- `docs/prd/parity-gaps-prd.md` -- section 5.2 (decision 13), 7.1 (SKILL-01 /
  CMD-01, CMD-09, SKILL-11 / CMD-10, DOC-01), 9 (S8), 10 (the "none" rows)
- `docs/research/parity-gaps/skills-commands.md` -- "Naming and invocation",
  "Current project behavior" (the PG-DOC-01 starting table), SKILL-01, CMD-09,
  SKILL-11, "Assumptions I could not verify"
- `docs/research/parity-gaps/hooks.md`, `mcp.md`, `workflows.md`, `core.md` --
  the evidence for the PG-DOC-02 rows
- `.planning/phases/11-skills-commands-and-records/11-SPIKE-S8.md` -- S8
  findings and confidence

### Recorded decisions this phase amends or relies on
- `.planning/PROJECT.md` -- D-141-01, D-141-02 (lines ~1877-1878), CM-2,
  D-CF1-01, D-CF1-02, D-CF1-03, D-CF2-02, D-CF2-05, D-CF3-12, SUB-01
- `.planning/phases/06-hook-inputs-and-events/` -- the typed-line handler
  changes for `UserPromptExpansion`
- `.planning/phases/10-plugin-options-variables-and-trust/10-CONTEXT.md` --
  D-PG10-13 (content fill order), D-PG10-16 (invocation-time
  `${CLAUDE_PROJECT_DIR}`), D-PG10-03 (PATH filter)

### Docs to write or correct
- `docs/skills-commands-compatibility.md` (new), `README.md` name mapping
- `docs/env-vars.md` -- `PATH` rows (28, ~122, ~161, ~180)
- `docs/research/claude-hooks-vs-pi-events.md`, `docs/mcp-compatibility.md`,
  `docs/prd/pi-claude-marketplace-prd.md` section 3, `.planning/BACKLOG.md`
  (`TOOLSEARCHOFF-01`, `WOUT-01`, `UAT-02`)

### Upstream evidence
- Claude Code 2.1.323 binary:
  `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`
  (`z_s`, `R3n`, `sls`, `Gas`, `pvr`, `mvr`, `AXe`, `pNe`, `$ys`, the hook
  runner env)
- `https://code.claude.com/docs/en/plugins-reference.md`,
  `https://code.claude.com/docs/en/skills.md` (fetched 2026-11-15)
- `.agents/skills/claude-code-compat-research/SKILL.md` -- evidence rules

### Pi source
- `node_modules/@earendil-works/pi-tui/dist/autocomplete.js:228-250` (native
  hint and description format), `autocomplete.d.ts` (`AutocompleteItem`)
- `node_modules/@earendil-works/pi-coding-agent/dist/cli/file-processor.js`
  (the `<file>` form)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `orchestrators/skill-alias-state.ts` -- `AliasKind`, `SKILL_KIND`,
  `COMMAND_KIND` (`names` reads frontmatter `name` only for commands; add the
  Claude Code name here), `claimedAliases`, `readSkillRecord`.
- `edge/skill-aliases.ts` -- `appendAliasSuggestions` builds
  `{ value, label }` only (`:43`); `commandAliasResult` rewrites a command
  alias to the Pi name for the command handler.
- `domain/name.ts` -- `generatedCommandName` (CM-2 elision, D-141-01/02).
- `orchestrators/command-invocation.ts`, `orchestrators/skill-invocation.ts`
  -- variable fill, argument substitution (`domain/argument-substitution.ts`),
  `!` injection (`domain/context-injection.ts`); the mention scan sits between
  the variable fill and the argument step.
- `edge/input-transform.ts` -- the zero-width-space guard on transformed text.
- `edge/command-tool.ts`, `edge/skill-read.ts` -- the model paths that do not
  attach in this phase.

### Established Patterns
- Typed invocation is a transform of the `input` event (D-CF1-01, D-CF2-05).
- Pure domain parsers with injected I/O; DI over test seams.
- Staged frontmatter carries the names the alias reader needs.

### Integration Points
- Phase 6 changed the typed-line handler for `UserPromptExpansion`; the
  mention scan must leave its payload (the typed line and arguments) as is.
- The completion cache and alias table are rebuilt per session
  (`names.clear()` at `session_start`).

</code_context>

<specifics>
## Specific Ideas

Evidence checked 2026-11-15:

1. Claude Code 2.1.323 attaches mentions from the rendered prompt-command
   content, `maxSizeBytes` 262,144, 2,000-line cut, directory as `ls`,
   Read deny rules per path; plugin `bin` only on the Bash and PowerShell tool
   `PATH`.
2. pi-tui 1.5.0 renders a native command suggestion's description as
   `` `${hint} — ${desc}` ``.
3. Use: 1 of 40 sample skills uses `@` for real (`claude-security`,
   `@${CLAUDE_SKILL_DIR}/role.md`); 1 of 33 commands needs the alias
   (`asana-setup.md`); 10 of 40 skills set `argument-hint`.

</specifics>

<deferred>
## Deferred Ideas

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

</deferred>

---

*Phase: 11-skills-commands-and-records*
*Context gathered: 2026-11-15*
