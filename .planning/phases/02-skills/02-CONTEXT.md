# Phase 2: Skills - Context

**Gathered:** 2026-11-01
**Status:** Ready for planning
**Mode:** autonomous (smart discuss; decisions made from upstream evidence, no
user prompts). The user's standing instruction for this run: "make decisions as
you see fit, but when in doubt research how claude code upstream operates, and
try to maintain compatibility unless we need to deviate for reasons specific to
the implementation of this project." Every decision below marked
**settled autonomously** was taken without the user; the run report lists the
ones a user might have decided differently.

<domain>
## Phase Boundary

Phase 2 makes a bridged skill look to Pi the way Claude Code 2.1.316 defines
it, and proves it with cucumber scenarios under `features/skill/` that observe
only what Pi reports (RPC `get_commands`, the registry probe, the scripted
model's call log, the TUI driver):

1. **Listing (SKL-01):** `/skill:<plugin>-<name>` with its description,
   including the D-CF1-04 fallback.
2. **Frontmatter (SKL-02):** `disable-model-invocation`, `user-invocable:
   false` (D-CF1-09), frontmatter `name` (FG-07, D-CF2-01), and the D-CF1-05
   fields.
3. **Invocation (SKL-03):** the Phase 1 cores (D-CF1-01 arguments, D-CF1-02
   injection) wired into the skill input path, the `<skill>` block compared
   whole in the model call log.
4. **Name clashes (SKL-04):** skill against command (FG-08, D-CF2-03) and
   skill against skill (D-CF2-04).
5. **The `/plugin:skill` alias (SKL-05):** in interactive input and RPC
   (FG-09, D-CF2-05), interactive proven through the TUI driver.
6. **Lifecycle (SKL-06):** disable, uninstall, update, and enable seen in a new
   session.
7. **The Pi report** for the gaps this phase records (D-CF2-10).

**Out of scope:** the commands bridge and every command FG item (Phase 3,
FG-11..FG-14); the frozen Phase 1 cores (a needed core change goes to the
parent); a model choosing a skill on its own (RM-01, D-CF1-03); hiding a
`user-invocable: false` skill (D-CF1-09, the user's 2026-10-31 decision).

</domain>

<upstream_evidence>
## Upstream evidence (Claude Code 2.1.316)

`claude --version`: `2.1.316 (Claude Code)`, binary `/opt/claude-code/bin/claude`,
probed and grepped 2026-11-01.

**Probe setup (all items E1-E6).** A throwaway tree under the session
scratchpad: a local marketplace `probe-mp` with one path-source plugin
`my-plugin`, a fresh `HOME` and `CLAUDE_CONFIG_DIR` inside the tree, and
`env -i PATH=/usr/bin:/bin` so no ambient variable leaked in. `claude plugin
marketplace add <tree>/mp` and `claude plugin install my-plugin@probe-mp`
(both exit 0). Session-level facts came from `claude -p "<prompt>"
--output-format stream-json --verbose`: the `system/init` record (its
`slash_commands` and `skills` arrays) needs no model. What the model would
receive came from pointing `ANTHROPIC_BASE_URL` at a local Node HTTP stub on
`127.0.0.1:18765` that saves each request body and answers 400; the API key was
the literal string `stub-not-a-credential`. No credential and no LLM was used.
The tree was kept only as the evidence below.

- **E1. A plugin skill's canonical name is its directory name; frontmatter
  `name` adds a user-facing name and aliases (FG-07).** `skills/review/SKILL.md`
  with `name: fancy`:
  - `claude plugin details my-plugin@probe-mp` lists the skill as `review`.
  - The init record lists `my-plugin:review` in `slash_commands` and `skills`;
    `my-plugin:fancy` is not in either.
  - The model's skill list reads `- my-plugin:review (my-plugin:fancy): Review
    skill with frontmatter name fancy`.
  - `/my-plugin:review x`, `/my-plugin:fancy x`, and the bare `/fancy x` all
    send `<command-name>/my-plugin:review</command-name>` and the `review`
    body.
  - Two skills `dupe-a` and `dupe-b` that both declare `name: same` both load
    under their directory names; only the first, `dupe-a`, gets
    `(my-plugin:same)`, and `/same x` runs `dupe-a`.
  - `name: other:thing` gives `my-plugin:coloned (my-plugin:other:thing)` and
    no bare alias.
  - The binary at byte 287674833: `function Qqn(e,n,r){let
    s=`${e}:${n.replace(/[^a-zA-Z0-9_-]/g,"-")}`,h=SAt(r,`plugin skill
    ${s}`)??"",y=!h?s:h.startsWith(`${e}:`)?h:`${e}:${h}`;return{name:s,loadedFrom:"plugin",userFacingName:()=>y,aliases:h&&!h.includes(":")?[h]:void
    0}}`, fed by `Xqn` (byte 287674612), which reads `frontmatter.name`.
  - Directory names: `foo.bar` gives `my-plugin:foo-bar`, `Mixed` keeps its
    case (`my-plugin:Mixed`), and `my-plugin-pre` gives
    `my-plugin:my-plugin-pre`. Upstream elides nothing: `/my-plugin:pre x`
    reaches the model as the literal text `/my-plugin:pre x`.
  - **Docs differ.** https://code.claude.com/docs/en/skills (retrieved
    2026-11-01), "How a skill gets its command name": "In a plugin skill, the
    frontmatter `name` replaces the directory name in the last segment of the
    command, so `my-plugin/skills/review/SKILL.md` with `name: fancy` becomes
    `/my-plugin:fancy`. The bare `/fancy` also invokes the skill unless another
    command already uses that name." The binary agrees that `/my-plugin:fancy`
    and `/fancy` work and that `/` menus show `userFacingName`, but the
    directory name stays the identity and keeps working. Confidence: high
    (probe plus source).
- **E2. A skill and a command with one qualified name in one plugin: the
  command wins (FG-08).** `skills/clash/SKILL.md` ("Clash skill",
  `SKILL CLASH BODY`) beside `commands/clash.md` ("Clash command",
  `COMMAND CLASH BODY`). `claude plugin details` counts both (`clash, clash`).
  The init record lists `my-plugin:clash` once. The model's skill list reads
  `- my-plugin:clash: Clash command`. `/my-plugin:clash hello` sends `COMMAND
  CLASH BODY\n\n\nARGUMENTS: hello`; the skill's body appears nowhere in the
  request. So the skill can be reached by neither the user nor the model.
  `/clash hello` (no frontmatter `name`, so no bare alias) is sent as literal
  text. **Docs differ:** the skills page's "Resolve skills that share a name"
  table gives "A skill and a file in `.claude/commands/` | The skill", which
  covers two locations, not one plugin. Confidence: high for the observed
  plugin case.
- **E3. Two skills with one qualified name in one plugin: the `skills/` copy
  wins.** `skills/twin/` and `extra/twin/` with `"skills": ["./extra"]` in
  `plugin.json`: one `my-plugin:twin` in the listing, and `/my-plugin:twin x`
  sends the `skills/` body. No message. Confidence: high.
- **E4. `/plugin:skill` is resolved outside interactive mode (FG-09).** Every
  E1-E3 invocation above ran in print mode (`-p`) with `stream-json` output,
  and each resolved the qualified and bare names. Claude Code has no Pi-style
  RPC, but its non-interactive entry points resolve plugin skill names exactly
  as the TUI does. Confidence: high.
- **E5. The skill message upstream.** `<command-message>` and
  `<command-name>` tags, then `Base directory for this skill: <dir>\n\n<body
  without frontmatter and leading blank lines>\n\n\nARGUMENTS: x` (three line
  feeds, because the body ends with one and `T2e` appends `\n\nARGUMENTS:`).
  Pi frames a skill its own way (01-CONTEXT Pi facts: `<skill name=...
  location=...>\nReferences are relative to <baseDir>.\n\n<body>\n</skill>`).
- **E6. Phase 1 evidence this phase pins** (not re-checked): `T2e`
  (01-CONTEXT E1), `HRe`/`MRr` (E2), `A2e` (E3), the `skills` union (E4),
  `user-invocable` (E6), and the bash-missing text (01-13,
  `bashMissingMessage`).

Pi facts (installed `@earendil-works/pi-coding-agent` 1.4.0, read
2026-11-01): `InputSource` is `"interactive" | "rpc" | "extension"`
(`dist/core/extensions/types.d.ts:908`). RPC mode sends `source: "rpc"`
(`dist/modes/rpc/rpc-mode.js:306`). `sendUserMessage` sends `source:
"extension"` with `expandPromptTemplates` false by default, so Pi itself does
not expand `/skill:` for an extension's message (`agent-session.js:1908-1935`).
Input handlers run before `_expandSkillCommand` (`agent-session.js:1594,
1661`).

</upstream_evidence>

<decisions>
## Implementation Decisions

### Names and aliases (FG-07, FG-09)

- **D-CF2-01 (generated Pi name; FG-07; settled autonomously):** The Pi name
  stays `/skill:<plugin>-<name>` derived from the source **directory** name
  (SK-2, `domain/name.ts::generatedSkillName`, unchanged). Frontmatter `name`
  does not change the generated name. Reason: E1. Upstream's identity is the
  directory name, both names invoke the skill, and two skills that share a
  frontmatter `name` both load upstream. Deriving the Pi name from frontmatter
  `name` would drop one of them. SK-3 keeps rewriting the staged `name`.
- **D-CF2-02 (alias names; FG-07; settled autonomously):** The `/plugin:skill`
  aliases are exactly Claude Code's names for the skill (E1, `Qqn`):
  1. `<plugin>:<dir>`, with each character outside `[a-zA-Z0-9_-]` replaced
     by `-` and case kept. Nothing is elided.
  2. When frontmatter `name` is set: `<plugin>:<name>`, or `<name>` itself
     when it already starts with `<plugin>:`.
  3. When frontmatter `name` is set and has no `:`, the bare `<name>`.
  Within a plugin, a frontmatter-name alias goes to the first skill in
  discovery order that claims it (E1, `dupe-a`). An alias never takes a name
  that a Pi command of another source already has, as today (SK-6). The
  elided form that the current alias loader derives from the generated name
  (`acme:foo` for directory `acme-foo`) is dropped, because upstream has no
  such name. A bare alias that two plugins both claim goes to the first in the
  loader's scope order (upstream's order across plugins was not probed).
  Residual difference, licensed by the Pi gap (Pi's validator allows only
  `a-z0-9-`, and a Pi skill has no display name or alias field): Pi's command
  list and the system prompt show only the generated name. Upstream shows
  `<plugin>:<name>` in its `/` menu and `(<plugin>:<name>)` to the model.
  Autocomplete offers the aliases, as today.
- **D-CF2-05 (where the alias applies; FG-09; settled autonomously):** The
  alias and the D-CF1-01/D-CF1-02 skill invocation run for `interactive` and
  `rpc` input. Reason: E4. Upstream resolves plugin skill names in every user
  entry point, not only the TUI. `extension` input passes through unchanged,
  because Pi itself expands slash commands in an extension's message only
  when that extension asks for it (Pi facts), and the input event does not
  carry that choice. Supersedes the "interactive Pi sessions" wording of SK-6.
  Interactive input and autocomplete are proven through the TUI driver, and
  RPC through a profile Pi.

### Name clashes (FG-08)

- **D-CF2-03 (skill against command; FG-08; settled autonomously):** In one
  plugin, a command whose upstream name (`<plugin>:<file basename>`) equals a
  skill's upstream name (D-CF2-02 item 1) wins, and the skill is not staged.
  Install reports one warning for the skipped skill in the skills bridge's
  discovery warnings, in the style of the D-07/D-141-04 duplicate warning
  (wording at Claude's discretion). Reason: E2. Upstream hides the skill from
  the user and from the model, so a `/skill:` entry and a system-prompt
  listing for it would be an unlicensed divergence. The install warning is
  this project's diagnostic. Upstream says nothing, and the D-07/D-141-04
  duplicate warning sets the precedent. The SK-6 rule stays: `/<plugin>:<name>`
  typed by the user reaches the command. A frontmatter-name alias (D-CF2-02
  items 2 and 3) that equals a command name is not registered.
  **Constraints:** the skills bridge must not import `bridges/commands/`
  (fallow zones) and Phase 2 must not edit it (Phase 3 owns it). The
  command names come from `resolved.componentPaths.commands` (already on the
  `MaterializablePlugin` the skills bridge receives, with D-CF1-06 applied):
  top-level `*.md` basenames, because a nested command's name has a `:` that
  no normalized skill name can contain.
- **D-CF2-04 (skill against skill; settled autonomously, pins D-07 and
  D-141-04):** Two skill directories with one upstream name (E3) or one
  generated name (SK-2 elision) keep today's first-wins rule and warning. The
  scenario pins that the `skills/` copy wins over a declared path's copy,
  which E3 shows upstream does. The planner confirms that
  `componentPaths.skills` lists `skills/` first and fixes it if not.

### Invocation (pins FG-01..FG-04, FG-05, D-CF1-01..03)

- **D-CF2-06 (skill invocation wiring; pins D-CF1-01, D-CF1-02, D-CF1-03):**
  The skill input handler (`edge/skill-aliases.ts`) resolves `/skill:<name>`
  or an alias, then:
  - substitutes arguments with `substituteArguments` from
    `domain/argument-substitution.ts`, passing
    `parseArgumentNames(frontmatter.arguments)` unchanged (01-12);
  - fills `variables` with `CLAUDE_SESSION_ID` (Pi session id),
    `CLAUDE_EFFORT` (`claudeEffort` of the session thinking level), and the
    install-time values (`CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`,
    `CLAUDE_SKILL_DIR`, and `CLAUDE_PROJECT_DIR` at project scope), so a typed
    argument that names one expands as upstream does;
  - runs `expandContextInjections` with the shell from `selectPromptShell`.
    A `bash-missing` choice aborts with `bashMissingMessage(<typed
    invocation>)`. An injection failure aborts with upstream's message through
    the notify chokepoint. When an invocation aborts, nothing reaches the
    model;
  - returns Pi's own `<skill name="..." location="...">` block with the
    substituted body and no raw arguments after it.
  The framing stays Pi's `<skill>` block rather than upstream's `Base
  directory for this skill:` text (E5). SKL-03 names the `<skill>` block, and
  Pi's model-invoked path reads `SKILL.md` in the same frame. The
  frontmatter `shell` and `arguments` are read from the staged `SKILL.md`. A
  model-invoked skill gets neither arguments nor injection (D-CF1-03).
- **D-CF2-07 (description; pins FG-06, D-CF1-04):**
  `descriptionFallback(body, "Plugin skill")` replaces `firstBodyParagraph`
  in `bridges/skills/stage.ts`. The `when_to_use` fold and the 1,536-character
  cap (WTU-01/02) apply on top of the computed base, as today.

### Frontmatter fields (pins FG-10, D-CF1-05, D-CF1-09)

- **D-CF2-08 (dropped fields; pins D-CF1-05):** The skills bridge adds
  `droppedInvocationFieldsWarning(<source>, frontmatter)` to its discovery
  warnings, one line per skill. It is not emitted for a skill whose
  frontmatter does not parse (SKILL-01 placeholder arm), because that skill
  already gets its own warning. `allowed-tools`, `arguments`, `shell`, and
  `user-invocable` are never reported.
- **D-CF2-09 (`user-invocable: false`; cites D-CF1-09):** The skill stays
  listed and runnable from `/`. The scenario pins both under D-CF1-09.
  `disable-model-invocation: true` passes through to Pi and matches upstream:
  the skill is absent from the system-prompt skill list and still runs on
  `/skill:`.

### Pi report, lifecycle, ownership

- **D-CF2-10 (the Pi report; settled autonomously):** Phase 2 writes the gap
  report for Pi as ready-to-file text in its SUMMARY.md, for the parent to
  hand to the user. The report covers three gaps: no per-skill way to hide a
  slash command (D-CF1-09); no display name or alias for a skill (D-CF2-02);
  and no extension hook on the model's own skill path (D-CF1-03). The phase
  does not post to any external tracker. It has no credentials for one, and a
  public post on the user's behalf is the user's call.
- **D-CF2-11 (lifecycle; SKL-06):** Disable, uninstall, update, and enable
  are observed in a new session through `get_commands` (and the alias through
  the profile Pi). They take effect at `/reload`, not upstream's
  `/reload-plugins` (NFR-2, APL-D2). Update shows the new description and
  body.
- **D-CF2-12 (ownership additions; settled autonomously):** Beyond the
  ROADMAP table, Phase 2 also owns `orchestrators/skill-alias-state.ts` and
  its unit test, which only skills use. It may add an optional,
  backward-compatible profile (extra extensions and environment) to
  `features/lib/pi-tui.ts` if the TUI alias scenario needs the scripted
  model. Existing callers do not change. Phase 2 does not edit
  `domain/name.ts` (D-CF2-01 leaves `generatedSkillName` as it is),
  `bridges/commands/**`, or the frozen Phase 1 cores.

### Review-fix decisions (taken by the parent, pending user review)

These two decisions came from code review rounds 2 and 3, after planning.
The parent took them without the user (DUBIOUS-CHOICES DC-29, DC-30). The
user has not reviewed them yet.

- **D-CF2-13 (provenance ledger of project skill installs; parent, pending
  user review):** A project-scope skill runs its `` !`command` `` lines and
  claims an alias only when a user-scope ledger lists it with a digest of its
  staged skill directory. The ledger is one file per project,
  `<agentDir>/pi-claude-marketplace/project-installs/<sha256(real project
  path)>/skills.json`, holding `{ version: 1, project, skills }`. The digest
  covers every regular file by its bytes and every symbolic link by its
  target string. Install, update, reinstall, and enable write the ledger
  under the project's state lock. Uninstall, disable, and `marketplace
  remove` drop the entries and show a ledger they cannot update as a cleanup
  warning. A project skill with no matching entry gets no alias, and its
  invocation aborts before any command runs and names
  `/claude:plugin reinstall <plugin>@<marketplace> --scope project`.
  Rationale: a cloned repository can ship its own staged skills and its own
  `state.json` under `.pi/pi-claude-marketplace/`, and Pi 1.4.0 trusts a
  project with no trust-requiring files on its own. Upstream parity: Claude
  Code records its installs in the user-owned `installed_plugins.json`, keyed
  by project path, and skips a project plugin that it lists for another path
  as `not_installed_here`. A repository cannot write that file. Residual
  (AR-02-05 in 02-SECURITY.md): plugin-root files outside the staged skill
  directory and the targets of symbolic links are not hashed.
- **D-CF2-14 (load-time autoapply applies only the user scope; parent,
  pending user review):** A load with `autoapply` on applies the user scope
  only, whichever config file turned the setting on. The project scope gets
  the read-only pass and the same pending block that `pending` prints, ending
  with the `/claude:plugin apply` trailer. An explicit `/claude:plugin apply`
  still applies both scopes and writes the D-CF2-13 ledger, because a command
  that the user types is consent. Rationale: with project autoapply, a
  repository's own config could install a plugin and write the ledger at
  load, so its skills' commands ran in the next session. Pi 1.4.0 gives the
  extension only `isProjectTrusted()`, which is also true for an auto-trusted
  project, and `platform/pi-api.ts` does not re-export `ProjectTrustStore`.
  So a load cannot tell explicit trust apart, and it never changes the
  project scope. Upstream parity: Claude Code reads repository-declared
  plugins and marketplaces only after the workspace trust dialog, and it asks
  the user before it installs them. It never installs them silently. This
  changes AAP-01 behavior for the project scope.
- **D-CF2-15 (the background autoupdate pass changes only the user scope;
  parent, pending user review):** The D-PL8-01 background pass, which the
  first message of a tui session arms, refreshes and updates only user-scope
  marketplaces and their plugins. It never reads or changes the project
  scope: not its marketplaces, not its plugins, not their dependency
  settlement, and so never the D-CF2-13 ledger. Rationale: the project's
  config, which can turn autoupdate on, and its `state.json`, which names the
  installed plugins, both sit in the repository. Through `update-swap.ts` the
  pass wrote the ledger for skills, commands, and hooks, so a cloned
  repository could get its own plugin recorded as this user's install with no
  command typed. This is the D-CF2-14 rule applied to the other automatic
  route that changes installs. An explicit `/claude:plugin update`,
  `marketplace update`, or `apply` still changes the project scope, and the
  load's pending block lists the project moves the pass leaves. Upstream
  parity: Claude Code never acts on a repository's plugin settings before the
  trust dialog and the install consent. This changes D-PL8-01 behavior for
  the project scope.

### Claude's Discretion

- How the alias loader learns each skill's source directory name and
  frontmatter `name` at session start. For example, the staged `SKILL.md` can
  carry them in an extra frontmatter key that Pi ignores. No `state.json`
  schema change, and no read of the plugin source at session start.
- The wording of the D-CF2-03 warning, in the style of the existing staging
  warnings.
- Which existing tests change for the dropped elided alias (D-CF2-02) and the
  `firstBodyParagraph` removal (D-CF2-07). Remove the old helper only if
  nothing else uses it.
- The plan split inside the ROADMAP's wave template.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md`: Phase 2, the milestone rules, file ownership, and
  merge procedure.
- `.planning/REQUIREMENTS.md`: SKL-01..SKL-06.
- `.planning/PROJECT.md` Key Decisions D-CF1-01..D-CF1-17.
- `.planning/research/FEATURES.md`: FG-04, FG-06..FG-10, and the skills table
  (S1-S17).
- `.planning/phases/01-harness-and-version-raise/01-CONTEXT.md`,
  `01-VERIFICATION.md`, and the SUMMARYs of 01-03 (harness step texts and
  world members), 01-10 (`descriptionFallback`,
  `droppedInvocationFieldsWarning`), 01-12 (`substituteArguments`,
  `parseArgumentNames`, `claudeEffort`), and 01-13
  (`expandContextInjections`, `selectPromptShell`, `bashMissingMessage`).
- `.planning/DUBIOUS-CHOICES.md` DC-03..DC-10 and DC-13.
- `docs/prd/pi-claude-marketplace-prd.md` SK-2, SK-3, SK-6.
- https://code.claude.com/docs/en/skills (retrieved 2026-11-01).
- `.agents/skills/cucumber/SKILL.md` and
  `.agents/skills/claude-code-compat-research/SKILL.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `edge/skill-aliases.ts`: the input handler (interactive only today; the
  `event.source !== "interactive"` early return is what D-CF2-05 changes) and
  the autocomplete provider.
- `orchestrators/skill-alias-state.ts::loadQualifiedSkillAliases`: builds
  aliases by reverse-deriving a suffix from the generated name
  (`skillSuffix`). D-CF2-02 replaces this with upstream names, keeps the
  `reserved` set (non-skill commands), and keeps the check that a skill file
  was actually loaded.
- `bridges/skills/discover.ts`: first-wins dedup by generated name and the
  `duplicateWarning` shape that D-CF2-03 copies. It already receives
  `resolved.componentPaths.commands`.
- `bridges/skills/stage.ts:135`: the `firstBodyParagraph` call that D-CF2-07
  replaces.
- `bridges/skills/rewrite-frontmatter.ts`: SK-3 rewrites the staged `name`.
- The Phase 1 cores: `domain/{argument-substitution,shell-words,context-injection,description-fallback,invocation-frontmatter}.ts`
  and `platform/prompt-shell.ts`. All are frozen.
- `edge/command-invocation.ts`: Phase 3's sibling handler. Do not edit it.
  Read it for the composition shape only.
- `features/lib/skill-files.ts` (`publishSkill`, `skillFileText`),
  `features/step_definitions/skill/invocation.steps.ts`, and
  `features/lib/pi-tui.ts` (TUI driver, no profile support today).

### Established Patterns

- Discovery warnings flow through the bridge's `warnings` array into the
  install notification.
- The handler order in `index.ts`: hooks UserPromptSubmit, background update,
  skill aliases, command invocation (01-10). `index.ts` is not edited.
- `.fallowrc.json` lists the unwired cores in `dynamicallyLoaded` and
  `ignoreExports`. The parent removes them after Phases 2 and 3 merge (DC-13
  item 6). Phase 2 does not edit those entries.
- The reviewed clone pairs in `bridges/{skills,commands}/{stage,discover,unstage}.ts`
  carry `fallow-ignore-next-line code-duplication` markers. A change on the
  skills side can break the marker on the commands side, and that shows only
  in the combined tree.

### Integration Points

- Pi `input` event, sources `interactive` and `rpc`.
- RPC `get_commands`, the registry probe, the scripted model's call log, and
  the TUI driver for the alias and its autocomplete.

</code_context>

<specifics>
## Specific Ideas

- Scenario literals for E1 and E2 come straight from the probe: a skill
  directory `review` with `name: fancy` is reachable as `/demo:review`,
  `/demo:fancy`, and `/fancy`, and listed as `/skill:demo-review`. A plugin
  with `skills/clash` and `commands/clash.md` lists no `/skill:demo-clash`
  and sends the command's body for `/demo:clash`.
- Each new product rule gets a red proof before its fix: the RPC alias, the
  frontmatter-name alias, the shadowed skill, and the `A2e` fallback.

</specifics>

<deferred>
## Deferred Ideas

- Showing `(<plugin>:<name>)` to the model and `<plugin>:<name>` in Pi's
  command list. This needs a Pi display-name field (in the D-CF2-10 report).
- Upstream's order for a bare alias that two plugins claim, and whether
  upstream matches slash names case-insensitively. Neither was probed.
- Object-map `commands` declarations (FG-13, Phase 3) and the D-CF2-03 clash
  check: re-check at the Phase 3 merge that a mapped command name is compared
  too.
- Arguments and injection for model-invoked skills (D-CF1-03).

</deferred>
