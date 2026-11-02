# component-features: Dubious Choices Log

Review queue for the choices made without the user during the
component-features milestone (`/gsd-autonomous`, started 2026-10-31). The user
asked that every sub-session report its dubious choices to the parent session,
that the parent collect them in one file for later review, and that nobody
interrupt the user unless a conflict is truly unresolvable. When in doubt, the
run follows Claude Code upstream and diverges only for a reason specific to
this project.

## How this file works

- Only the parent session writes this file. Each subagent and sub-session ends
  its report with a `## Dubious Choices` section (or says "None"), and the
  parent copies every item here, so parallel work never conflicts on it.
- One entry per choice: what was chosen, the alternatives, why it is dubious,
  the upstream evidence, and where the choice is recorded (decision ID, file).
- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call that a reviewer may reverse at low cost. Low:
  process, naming, or tooling.
- **Status.** `open` until the user reviews it; the user marks it `accepted`,
  `reversed`, or `follow-up`.

## Decisions waiting on you

The short list. Each item names the entry that holds the details. The per-phase
logs (P3-DC, P4-DC, P5-DC, P6-DC, P7-DC) are copied in full in the
[appendix](#appendix-per-phase-logs-in-full).

### A. What blocks the milestone close

The milestone audit, complete, and cleanup steps wait on these three.
Afterwards, run `/gsd-verify-work 02` and `/gsd-verify-work 06`.

1. **Phase 2: the Pi gap report.** File the draft in
   `.planning/phases/02-skills/02-07-SUMMARY.md`, or decide not to. It lists
   the skill gaps and, since Phase 3, the command gaps (D-CF2-10; DC-24 item 4,
   DC-29).
2. **Phase 6: the agent MCP-tool gap (D-CF6-10, MCP-07).** pi-subagents 0.84.0
   refuses an agent's call to a plugin MCP tool. The phase pins that refusal as
   a recorded gap instead of showing a working call. Accept the pin, or reject
   it, which needs a pi-subagents change and harness work (DC-32 item 1).
3. **Phase 6: symlinks in a referenced MCP file (WR-01, WR-02).** A referenced
   `mcpServers` file now refuses every symlink, even one inside the plugin
   folder. Claude Code follows it. The refusal text also says "escapes plugin
   root" for an in-root link (DC-32 item 2).

### User decisions (2026-11-02)

**A.1, the Pi gap report: resolved item by item.** The user's rule: report
only what is a real Pi bug. Where Pi simply works differently from Claude
Code, accept the deviation and keep the extension consistent.

| Item | Pi's position | User's decision | Action |
| --- | --- | --- | --- |
| 1. Hide a skill from `/` (`user-invocable: false`) | Design: typed `/skill:name` always works | Accept, keep as is | None. D-CF1-09 and D-CF3-02 stand |
| 2. Skill display names and aliases | Design: Agent Skills naming rule | Accept; add command aliases | Implement command frontmatter-name aliases (closes P3-DC-07) |
| 3. Hook when the model loads a skill | Design: the model reads `SKILL.md` | Accept; fill variables | Rewrite a model read of a staged `SKILL.md` through `tool_result`: fill `${CLAUDE_*}`, no `!` commands (amends D-CF1-03) |
| 4. Model can't see or run templates | Design: templates are user input | Build the tool now | Extension tool that lists described commands and returns the expanded body, no `!` commands (closes the D-CF3-01 gap) |
| 5. Template name is the file name | Design: documented | Accept, keep as is | None |
| 6. Transform result expanded again | Inconsistent design (`prompt()` has an opt-out, a transform does not) | Fix here, and fix Pi upstream | Zero-width-space prefix here; a Pi patch in `.planning/upstream/` for the user to review before an upstream PR |

No gap report is filed. Item 6 goes upstream as a pull request instead, after
the user reviews it. Creating a Pi fork from this session was refused (the
repository is outside the session's access), so the patch waits for the user
to fork `earendil-works/pi`.

**A.2, an agent calling a plugin MCP tool (D-CF6-10, MCP-07): accepted as a
deviation, with upstream fixes.** Investigation on 2026-11-02 found three
separate causes:

1. **Design (pi-subagents docs, `agents.md` l.553):** a foreground child never
   loads ambient extensions. An agent that needs pi-mcp-adapter's tools must
   run in the background (`async: true`).
2. **pi-subagents 0.84.0 bug A:** its config validator rejects
   `directTools: "search"`, which pi-mcp-adapter 7.0 allows and the extension
   writes for every plugin server (ANAME-04). Every bridged server is dropped,
   so even a background agent gets "Unresolved MCP direct-tool selectors". This
   is the cause the D-CF6-10 scenario pins.
3. **pi-subagents 0.84.0 bug B:** its cache key does not expand
   `${VAR:-default}` the way pi-mcp-adapter 7.0 does, so a server that uses
   that form in `env` or `headers` never matches the adapter's cache.

The user accepted the foreground refusal as pi-subagents' design. Actions:
the extension writes `async: true` for agents granted MCP tools, which is
consistent with Pi but differs from Claude Code's foreground run. Patches for
bugs A and B are drafted for the user's review, with no PR. MCP-07 closes as
an accepted deviation, with a BACKLOG item to prove a background call once
pi-subagents is fixed and the harness can run background children. The
earlier "cache-key mismatch" explanation of the D-CF6-10 refusal was wrong for
that scenario; bug A is the cause.

**A.3, symlinks in MCP config files (WR-01, WR-02): follow links that stay
inside the plugin.** A referenced `mcpServers` file may now follow a symbolic
link whose real target resolves inside the plugin folder, as Claude Code
2.1.316 does (probed). A link that points outside stays refused. The root
`.mcp.json` keeps following links anywhere, as upstream does. The refusal
message for a link stops saying "escapes plugin root" when the link stays
inside. MCPR-04 is amended for in-plugin links.

### B. Security decisions taken without you

These four are marked "Pending (user review)" in `.planning/PROJECT.md`.
Together, they make a project's skills, commands, and hooks run only when this
user installed that plugin into that project, as Claude Code does.

1. **D-CF2-13: a user-scope install record per project** (DC-29, DC-36; also
   D-CF3-07 for commands). Project installs made before this change stop
   working until the user reinstalls them.
2. **D-CF2-14: a load with autoapply on changes only the user scope** (DC-30).
   An explicit `/claude:plugin apply` still applies both scopes.
3. **D-CF2-15: background autoupdate changes only the user scope** (DC-37).
4. **D-CF2-16: a re-stage that names no plugin never creates a record**
   (DC-38). This covers bare `update` and `reinstall`, the `marketplace update`
   cascade, and `apply`'s catalog moves. Residual: `apply` still records the
   plugins the project config declares.
5. **Two open medium threats with no decision yet** (DC-38, last bullet):
   T-05-33 (a hook's output cut at 1 MB reads as "no decision" under
   `onFailure: "block"`) and T-05-34 (a project's `CLAUDE_PLUGIN_DATA` folder
   sits inside the repository).
6. **Accepted risks to confirm:** AR-02-05 and AR-05-06. The record covers only
   the staged skill folder or `hooks.json`, not other plugin files (DC-30
   item 6, DC-36 item 4).

### C. High-severity choices that change what a user sees

- **Skills (DC-24):** the frontmatter-name aliases follow Claude Code, and the
  old elided alias is gone. A command now wins over a skill of the same name.
- **Commands (DC-34):**
  - Commands stay hidden from the model, a Pi gap (P3-DC-03).
  - `user-invocable: false` commands stay listed and runnable (P3-DC-04).
  - A marketplace entry's `commands` now adds to `commands/`. This corrects
    DC-07 / D-CF1-06 for commands (P3-DC-06).
- **Agents (DC-33):**
  - A preloaded skill goes into the agent's system prompt (D-CF4-04).
  - Agents run in the foreground by default (D-CF4-05).
  - Every bridged agent is shown to the parent model (D-CF4-14).
  - Project agents are refused in untrusted folders (D-CF4-09).
  - No background-agent scenario exists (D-CF4-10).
- **Hooks (DC-35):**
  - `fork` sends SessionEnd `resume`, and `/reload` runs no session hooks
    (P5-DC-03).
  - Three parity gaps are licensed only by phase ownership (P5-DC-04).
  - Unrecorded project hooks are skipped with no message (DC-36 item 3).
- **MCP servers (DC-32):**
  - `.mcp.json` and declared servers now merge, replacing PRD MC-1
    (P6-DC-01).
  - A broken or unreadable server file is skipped with no message, including
    on a permission error (P6-DC-02, P6-DC-07, P6-DC-18).
  - Project servers keep the adapter's approval step (P6-DC-03).
- **Workflows (DC-31):**
  - A workflow runs with no approval prompt (P7-DC-03).
  - Arguments arrive as an object (D-CF7-02).
  - Bad scripts are refused at install (D-CF7-03); a script with bad `meta`
    is installed with a warning (D-CF7-04).
- **Earlier milestone choices:** `$N` and `${...}` substitution at invocation
  time (DC-03). `` !`cmd` `` runs with no permission gate (DC-04). Declared
  paths replace the folder (DC-07; changed for commands by P3-DC-06).

### D. Process findings

- **Upstream probes leaked.** The Claude Code binary read the host's token
  files under `/home/claude/.claude/remote` (DC-33 item 6). It also contacted
  `api.anthropic.com` and received a signed policy (DC-34 item 1), even under
  `env -i`. No credential was saved, and the key results were re-run offline.
  The research skill now requires `unshare -rn`.
- The phase sessions are finished but not archived. Archiving needs your
  approval.

## Entries

### DC-01: Pre-fan-out decisions settled without the user

- **Phase / source:** milestone-wide; parent session.
- **Severity:** Medium. **Status:** open.
- **Choice:** The decisions that ROADMAP.md and DEC-01 say Phase 1's discuss
  step settles "with the user" (FG-01..FG-06, FG-10, FG-14, FG-29, FG-33, the
  six function directory names) are settled by the parent session from
  upstream research, per the user's instruction for this run.
- **Alternatives:** Stop and ask the user, as the roadmap text says.
- **Why dubious:** The roadmap made these decisions a user gate because six
  parallel phases depend on them. Each decision has its own entry below so
  that the user can reverse any one of them.
- **Recorded in:** `.planning/phases/01-harness-and-version-raise/01-CONTEXT.md`.

### DC-02: Phase discovery read from STATE.md, not `init.manager`

- **Phase / source:** milestone-wide; parent session.
- **Severity:** Low. **Status:** open.
- **Choice:** `gsd-tools query init.manager` reported all seven phases as
  executed with stale verification, because `.planning/phases/` does not exist
  yet and the tool matched the phase numbers against archived milestone phase
  directories (`01-manifest-read-fidelity`, `04-install-provenance`, ...). The
  run ignored its "re-run `/gsd-execute-phase N`" actions and treated STATE.md
  (Phase 1 of 7, not started) and `init.phase-op` (no context, no plans) as the
  truth.
- **Alternatives:** Follow the manager's actions, which would have run
  execute-phase against archived plans of an earlier milestone.
- **Why dubious:** It overrides a tool verdict. It is a GSD tooling defect
  worth reporting upstream: phase numbers repeat across milestones here.
- **Recorded in:** this file only.

### DC-03: Upstream argument substitution, done at invocation time

- **Phase / source:** Phase 1 discuss (D-CF1-01; FG-01..FG-04).
- **Severity:** High. **Status:** open.
- **Choice:** Bridged commands and skills get Claude Code's exact argument
  rules: `$0` is the first argument (0-based), a missing index stays literal,
  `ARGUMENTS: <args>` is appended when no placeholder is used, named
  `$name` arguments and the `\$` escape work, Pi-only forms (`${1:-x}`, `$@`)
  stay literal. One port of upstream `T2e` runs in Pi's `input` event; Phase 2
  wires skills, Phase 3 wires commands.
- **Alternatives:** (a) Record a Pi-gap divergence and keep Pi's 1-based rules.
  (b) Rewrite placeholders at install time into Pi syntax (cannot do
  `${CLAUDE_SESSION_ID}`, the conditional append, or injection).
- **Why dubious:** It is product work inside a test milestone, and it changes
  what a command receives: a plugin written for the old docs, where `$1` was
  the first argument, now gets the second one, exactly as in Claude Code
  2.1.316. Commands now bypass Pi's own template expansion.
- **Upstream evidence:** 2.1.316 binary, `T2e` and `G=(i)=>(L??=c$o(n))[i]`
  (0-based), grepped 2026-10-31. High confidence.
- **Recorded in:** `01-CONTEXT.md` D-CF1-01.

### DC-04: Run `` !`cmd` `` injection, with no permission gate

- **Phase / source:** Phase 1 discuss (D-CF1-02; FG-05).
- **Severity:** High (security). **Status:** open.
- **Choice:** In user-invoked bridged commands and skills, run each
  `` !`cmd` `` and ```` ```! ```` block before the content reaches the model, as
  upstream does. Pi has no permission modes, so the bridge acts like Claude
  Code's `bypassPermissions` mode: every command runs, and `allowed-tools`
  does not gate it. A failing command aborts the invocation.
- **Alternatives:** (a) Record a Pi gap and send the literal text (safest, but
  breaks common plugins such as commit helpers that use `` !`git status` ``).
  (b) Gate commands with the frontmatter `allowed-tools` patterns, which means
  porting Claude's Bash permission matching.
- **Why dubious:** Upstream refuses a command its permission check does not
  allow; this runs it. The risk is bounded: the command comes from a plugin
  the user installed, whose hooks can already run any command without being
  invoked, and Pi's model can already run any shell command.
- **Upstream evidence:** 2.1.316 binary, `HRe`, `MRr`, `Ahe`, grepped
  2026-10-31. High confidence.
- **Recorded in:** `01-CONTEXT.md` D-CF1-02.

### DC-05: Skill description fallback changes (D-86-06 superseded)

- **Phase / source:** Phase 1 discuss (D-CF1-04; FG-06).
- **Severity:** Medium. **Status:** open.
- **Choice:** A skill or command without `description` gets upstream `A2e`:
  the first non-blank line, heading hashes removed, cut to 97 chars plus
  `...`. This replaces the skills' "first prose paragraph" rule (D-86-06), and
  commands get the description written at install instead of Pi's 60-char cut.
- **Alternatives:** Keep D-86-06, a recorded decision that licenses the
  current behavior.
- **Why dubious:** It reverses a recorded decision and changes the listing a
  user sees. D-86-06 followed older upstream docs, so the change follows its
  intent.
- **Upstream evidence:** 2.1.316 binary, `A2e`, grepped 2026-10-31. High.
- **Recorded in:** `01-CONTEXT.md` D-CF1-04.

### DC-06: Which unhonored frontmatter fields install reports

- **Phase / source:** Phase 1 discuss (D-CF1-05; FG-10).
- **Severity:** Medium. **Status:** open.
- **Choice:** Skills and commands report `disallowed-tools`, `model`,
  `effort`, `agent`, `context`, `background`, `hooks`, and `paths` with one
  `[<source>] dropped fields:` warning, as agents do. They do not report
  `allowed-tools` (it only grants tools, and Pi asks for none) or
  `user-invocable` (the user kept its behavior on 2026-10-31).
- **Alternatives:** Stay silent (today), or report every field, including
  `allowed-tools`, which appears in many commands.
- **Why dubious:** It adds install warnings that existing plugins never
  showed, and the `allowed-tools` and `user-invocable` exclusions are
  judgment calls.
- **Recorded in:** `01-CONTEXT.md` D-CF1-05.

### DC-07: Declared command, agent, and workflow paths replace the folder

- **Phase / source:** Phase 1 discuss (D-CF1-06; FG-14).
- **Severity:** High. **Status:** open.
- **Choice:** A declared `commands`, `agents`, or `workflows` path now
  replaces the conventional folder, with a warning when an existing folder is
  shadowed; `skills` still adds. This supersedes the locked decisions D-07
  (COMP-01) and D-24 for those three kinds.
- **Alternatives:** Keep the union. D-07 is a recorded decision, so the
  project rules allow keeping it (the research recommended keeping it).
- **Why dubious:** A plugin that declares a custom `commands` path and also
  ships `commands/` loses the folder's commands on its next install or
  update. Upstream does the same today. D-24 itself says it adopted the union
  to match upstream as documented in 2026-05.
- **Upstream evidence:** 2.1.316 binary, `Et=!Se.commands&&Me` and
  `folder-shadowed-by-manifest`, grepped 2026-10-31. High confidence.
- **Recorded in:** `01-CONTEXT.md` D-CF1-06.

### DC-08: Harness trust through the trust store; MCP approval opt-in

- **Phase / source:** Phase 1 discuss (D-CF1-07).
- **Severity:** Low. **Status:** open.
- **Choice:** The profile Pi trusts its project through a persisted trust
  entry (not `--approve`), and project MCP server approval is a separate
  `Given`, not a default.
- **Alternatives:** `--approve`; `defaultProjectTrust: "always"`; approve
  project MCP servers by default.
- **Why dubious:** HAR-06 reads as if the default profile also approves
  project MCP servers. Keeping approval opt-in lets Phase 6 settle FG-29
  either way.
- **Recorded in:** `01-CONTEXT.md` D-CF1-07.

### DC-09: `${NAME:-default}` left to the adapter at connect time

- **Phase / source:** Phase 1 discuss (D-CF1-13; VER-05).
- **Severity:** Medium. **Status:** open.
- **Choice:** Under pi-mcp-adapter 7.x, write `${NAME:-default}` for the
  adapter to expand when it starts the server, as Claude Code does, unless
  the conformance proof finds the adapter's `:-` rule differs from Claude's.
- **Alternatives:** Keep resolving defaults at install (today).
- **Why dubious:** A variable set after install now takes effect without a
  reinstall, which is upstream behavior but a change for existing installs.
- **Recorded in:** `01-CONTEXT.md` D-CF1-13.

### DC-10: Shared cores added to Phase 1

- **Phase / source:** Phase 1 discuss.
- **Severity:** Medium. **Status:** open.
- **Choice:** The argument, injection, description, and dropped-field cores
  and the component-directory change are built in Phase 1, frozen, and only
  wired by Phases 2-7. A component phase that needs a core change reports it
  to the parent, which applies it on the milestone branch.
- **Alternatives:** Let Phases 2 and 3 implement them separately.
- **Why dubious:** Phase 1 grows by about two plans and delays the fan-out,
  in exchange for one implementation instead of two that could drift.
- **Recorded in:** `01-CONTEXT.md` `<specifics>`.

### DC-11: UI design-contract step skipped on a false frontend match

- **Phase / source:** Phase 1, autonomous step 3a.5; parent session.
- **Severity:** Low. **Status:** open.
- **Choice:** `gsd-tools check ui-plan-gate 1` answered `frontend: true`
  only because the goal contains the word "component" (plugin components);
  it found no frontend evidence, and `workflow.ui_phase` is false. The only
  `plan:pre` step hook with a skill is `ai-integration-phase`, not a UI hook.
  The run skipped the step, as the workflow does for `ui_phase=false`.
- **Alternatives:** Run `gsd-ai-integration-phase 1`, which the literal rule
  would have dispatched.
- **Why dubious:** It departs from the literal workflow text. A GSD tooling
  issue: the gate's keyword match and the "any step hook means ui_phase is on"
  assumption both misfire here.
- **Recorded in:** this file only.

### DC-12: Planning without reversibility checkpoints

- **Phase / source:** all planning; parent session.
- **Severity:** Medium. **Status:** open.
- **Choice:** Plans are made as with `--no-reversibility-gates`: a one-way-door
  decision is still rated and recorded on its task, but it does not become a
  human `checkpoint:decision` that stops execution. Workflow prompts that
  offer a recommended option (for example "research first?") take it.
- **Alternatives:** Keep the default gates, which would stop the run for the
  user at each one-way-door decision.
- **Why dubious:** It removes a safety stop the workflow has by default. The
  user asked not to be interrupted, and the flag exists for unattended runs.
- **Recorded in:** this file; the planner prompt says
  `REVERSIBILITY_GATES: false`.

### DC-13: Phase 1 research choices (accepted by the parent)

- **Phase / source:** Phase 1 researcher (`01-RESEARCH.md`); the parent
  accepted each item below for planning.
- **Severity:** Medium overall. **Status:** open.
- **Items:**
  1. **`:-` as a hybrid (D-CF1-13).** pi-mcp-adapter 7.0 runs its `$env:` and
     `{env:}` passes over a filled-in default, which Claude never re-reads, so
     `${A:-$env:HOME}` would leak. The adapter gets `${NAME:-default}` only
     when the default holds no `$env:`/`{env:` text; otherwise the bridge
     keeps install-time resolution. Alternative: all-or-nothing.
  2. **`shell: powershell` on Linux and macOS** runs Bash unless
     `CLAUDE_CODE_USE_POWERSHELL_TOOL` is set, as upstream (`Vv()`, `jd()`).
     This refines D-CF1-02's wording.
  3. **`${CLAUDE_EFFORT}`** comes from Pi's thinking level: `off` and
     `minimal` become `low`; a frontmatter `effort` is ignored (D-CF1-05).
     Upstream default is `high`.
  4. **The component-directory plan runs in wave 3**, not wave 1: its scenario
     needs 01-03's generic file step.
  5. **The argument tokenizer port** treats tree-sitter-bash 0.25.1 output as
     upstream's expected values; Claude's bundled grammar version is unknown,
     and some rows are error-recovery quirks (`--flag=1 -v` gives `["-v"]`).
  6. **Unwired cores and fallow.** Cores built now but wired by Phases 2 and 3
     are listed in `.fallowrc.json` `dynamicallyLoaded` and `ignoreExports`.
     The parent removes those entries after Phases 2 and 3 merge.
  7. **Package legitimacy.** The audit marked all six new package versions
     "suspicious" only because they are new releases. The recorded evidence
     (same source repositories, no postinstall scripts) replaces the human
     checkpoint the protocol asks for.
  8. **HAR-06 observation.** The trusted and untrusted pair observes a
     project-scope agent through pi-subagents (seed in `features/agent/`).
     The untrusted `Given` must also write a trust-requiring file such as
     `.pi/settings.json`, because Pi trusts a project without one.
- **Recorded in:** `01-RESEARCH.md` (Q1-Q5, Pitfall A, Open Questions).

### DC-14: Pattern-map open points left to the planner

- **Phase / source:** Phase 1 pattern mapper (`01-PATTERNS.md`).
- **Severity:** Low. **Status:** open.
- **Items:** the spike 028 prototypes are named as "exact" analogs for the
  scripted model, probe, and stub although they are prototypes; the hook
  recorder and MCP stub are spawned by path and may need fallow handling
  (unmeasured); the folder-shadowed warning (D-CF1-06) is suggested through
  the resolver's `notes` without tracing whether that reaches the install
  notification; an optional ESLint zone for `platform/prompt-shell.ts` that
  CONTEXT does not ask for.
- **Recorded in:** `01-PATTERNS.md`.

### DC-15: Phase 1 planning choices

- **Phase / source:** Phase 1 planner (`01-01-PLAN.md` … `01-15-PLAN.md`).
- **Severity:** Medium. **Status:** open (plan check pending).
- **Items:**
  1. **15 plans instead of 9 + 2.** 01-01 is split: 01-15 takes the Pi
     1.4.0 e2e floor fixture, Pi types, and version docs. The invocation core
     is split across 01-10, 01-12, and 01-13. Reason: `.fallowrc.json` can
     have one editor per wave, and fallow accepts a `dynamicallyLoaded` path
     whose file does not exist yet (measured), so 01-10 registers all six core
     paths in wave 1. An inline `fallow-ignore-file` marker would turn stale
     once Phase 2 or 3 imports the file (measured), so the config route is
     required.
  2. **D-CF1-13 split:** 01-01 keeps install-time `:-` resolution and widens
     the adapter TRIGGER in wave 1 (keeps the 7.0 drift guard green); 01-14
     adds the delegation in wave 2.
  3. **Component-directory plan 01-11 moved to wave 2** (reverses DC-13 item
     4): it now defines its own generic plugin-file step.
  4. **Shadowed-folder warning** shows on install, enable, import, apply,
     update, and reinstall; travels as a typed optional resolver field plus a
     discovery warning; text is upstream's `Default <kind>/ folder is ignored
     because the manifest sets "<kind>"`.
  5. **Ownership inside Phase 1:** 01-03 does not edit `ci.yml` (01-01 makes
     `test:cucumber` install peers first); the generic file step lives in
     01-11; 01-04 alone edits `world.ts`/`session.steps.ts`, 01-07 alone edits
     `model.steps.ts`/`companion.steps.ts` in wave 3.
  6. **Project-server approval Given** lands in Phase 1 and a seed uses it.
     It writes `settings.projectServers: "allow"` to `<agentDir>/mcp-adapter.json`
     (adapter 7.0 `config.ts:218`), not `~/.config/mcp/mcp.json`. FG-29 stays
     open.
  7. **Workflow seed runs with no arguments**, so FG-32's argument shape is
     left to Phase 7.
  8. **The model-turn When fails** on any extension error or dialog during the
     turn; a phase that needs to observe one adds its own When.
  9. **`!` spawn residuals (D-CF1-02):** PowerShell is `pwsh -NoProfile
     -Command` on Linux/macOS and `powershell.exe` on Windows; 120 s timeout
     uses the "interrupted" message; output is not truncated; core error
     classes live in their own modules rather than `shared/errors.ts`; no
     ESLint zone restricts importers of `prompt-shell.ts`.
  10. **Smaller:** CHANGELOG entry has no PR number yet (parent appends it);
      an undefined thinking level maps `${CLAUDE_EFFORT}` to `high`; the
      profile Given turns Pi auto-retry off (settles research A6); core plans
      list DEC-01 as their requirement; automated `npm view` legitimacy checks
      replace human checkpoints (DC-13 item 7).
- **Probe note:** `check verify-command-paths 1` flagged one warning
  (01-09 Task 3, `script_missing`), a misread: the `npm run test:e2e` half
  runs at the repo root, not in the `--prefix` directory.
- **Recorded in:** the plans' "Flagged assumptions" sections and `COVERAGE.md`.

### DC-16: Plan-check revisions made by the parent

- **Phase / source:** Phase 1 plan checker (0 blockers, 2 warnings, 1 info).
- **Severity:** Low. **Status:** open.
- **Items:**
  1. **Cucumber scenario for connect-time `:-` (warning 1).** The parent,
     not a re-spawned planner, added Task 3 to `01-06-PLAN.md`: a plugin
     server's `env` holds `${PI_CM_STUB_TAG:-install-default}`, the variable is
     set after install, and the model sees `late:echo:ping`. 01-06 now depends
     on 01-14 and lists VER-05. The stub prefixes its echo with `STUB_TAG` when
     set, so Task 1's expectations do not change. The task may need a new
     `Given` that sets a variable in the profile Pi's process environment.
  2. **Three plans over 15 files (warning 2) not split further:** 01-01 (19),
     01-15 (18), 01-11 (16). Most files are source-test pairs and docs; each
     plan has 3 tasks; the planner already split once.
- **Recorded in:** `01-06-PLAN.md`, `01-14-PLAN.md` objective.

### DC-17: Executor prompts read the GSD execution files by path

- **Phase / source:** parent, Phase 1 execution (`execute-phase.md` step 3).
- **Severity:** Low. **Status:** open.
- **Items:**
  1. The workflow asks the orchestrator to paste `execute-plan.md`,
     `templates/summary.md`, `references/checkpoints.md`, `references/tdd.md`
     (TDD plans), `references/worktree-path-safety.md`, and
     `references/executor-examples.md` verbatim into every executor prompt
     (about 2,400 lines each, 15 executors). The parent instead tells each
     executor to Read those files in full, by absolute path, before any work.
     The executor sees the same text; the parent keeps its context budget.
  2. Executor prompts add a `<project_rules>` block: commit titles carry no
     milestone, phase, plan, wave, or task ID (AGENTS.md); the two attribution
     trailers; never push; the `pre-commit run --files` step. The workflow
     forbids extra gate-override text, and the block contains none.
  3. The repo has no `CLAUDE.md`; prompts point executors at `AGENTS.md`.
- **Recorded in:** this log only.

### DC-18: Phase 1 wave 1 executor choices

- **Phase / source:** executors for plans 01-01, 01-02, 01-10, 01-15.
- **Severity:** Medium (the root-permission workaround and the mislabeled commit); the rest Low. **Status:** open.
- **Cross-cutting:**
  - **Root sandbox.** This session runs as root, which ignores the `chmod` tricks the permission-injection tests use: 128 unit cases, 38 cucumber scenarios, and 1 integration case fail on any tree. Executors and the parent run npm scripts with `npm_config_script_shell` pointing at a `setpriv` wrapper that drops `dac_override` and `dac_read_search`. No hook or check is skipped. A repository-level fix (for example, skipping those cases when `process.getuid() === 0`) is not made.
  - **ESLint heap.** Cold-cache ESLint runs ran out of the default heap under parallel load; commits and gates use `NODE_OPTIONS=--max-old-space-size=6144`.
  - **Shared scratchpad collision.** Commit `8b191cb` holds the Pi 1.4.0 e2e fixture files but carries the dependency-raise commit message. It was not amended (no history rewrites). Later executor prompts get a per-agent scratch folder.

#### 01-02 (cucumber rules and decision records)
1. D-CF1-14..17 rows cite DC-01, which lists only pre-fan-out items; a Phase 1 decisions entry may be wanted and those labels updated.
2. The layout rule section in `.agents/skills/cucumber/rules/layout.md` uses "Phase 1" and phase numbers (milestone-scoped, copies ROADMAP; key link greps "Frozen after Phase 1"), although process names are kept out of durable files.
3. Seed feature and step names written before the harness exists; 01-09 must correct the table if the built names differ.
4. New PROJECT.md Key Decisions rows padded to the table's column widths (~7,700 chars per row).
5. D-CF1-03 rationale (upstream applies T2e/HRe when its Skill tool loads a plugin skill) inferred from research, not re-grepped in the binary.
6. HAR-08 prohibition (pin a divergence only with a decision ID or Pi gap) placed in `layout.md`, not `features.md` (not in the file list).
7. Cross-kind wording follows ROADMAP ("frozen fixture writers such as published-marketplace.ts").
8. Flagged assumptions stay open: one Key Decisions row per decision (DEC-01); the contradicting bullet is "Custom component-path arrays as supplemental" (DEC-02).
#### 01-10 (command-invocation seed, frontmatter cores, fallow registration)
1. The pass-through `input` handler in `edge/command-invocation.ts` is not recorded as a stub in the WINDOWS ledger (it is specified behavior until the D-CF1-01/02 transforms land).
2. One-line comments on the D-CF1-05 dropped-field table describe upstream fields from Claude Code docs, not from the binary.
3. Environment: a commit hook failed when ESLint ran out of memory under parallel load; the agent re-ran it with `NODE_OPTIONS=--max-old-space-size=6144` (no `--no-verify`). A heap flag in the `lint` script may be worth considering.
4. Ran `SKIP=npm-check pre-commit ...` (the worktree guard refused `${SKIP:+,$SKIP}`; SKIP was empty).
5. Extra test row (heading over 100 chars) and a D-CF1-01/02 comment at the registration call site explaining ordering.
- Parent follow-up: remove the six `.fallowrc.json` `dynamicallyLoaded`/`ignoreExports` entries after Phases 2 and 3 merge.
#### 01-15 (Pi 1.4.0 floor fixture, Pi types, version docs)
1. Running as root, two chmod-based tests (`test/bridges/agents/stage.test.ts`, `test/bridges/agents/discover.test.ts`) fail in the full-pairs commit hook regardless of the change; the agent committed through an `npm_config_script_shell` wrapper that turns off root's permission override for npm scripts (hook still ran in full, no `--no-verify`). A repository-level fix may be preferable.
2. Commit 8b191cb holds 01-15 Task 1 files but carries 01-01's message (`build(deps): raise Pi to 1.4.0 and the companion floors`) after a shared-scratchpad file collision; not amended (history rewrites forbidden).
3. Added `fallow-ignore-next-line unused-type` markers on `ThinkingLevel` and `InputSource` in `platform/pi-api.ts` (unused until Phase 2); CONVENTIONS.md marker count (41) is now stale (43).
4. `docs/env-vars.md` line 164 keeps its 5.2.0 measurement plus a note that the `resolveEnv` call site was re-read in 7.0.0 (only that path re-checked).
5. `docs/env-vars.md` line 3 names 7.0.0 relying on 01-01's conformance test, which ran in parallel.
6. Unrequested rename of the canary scratch folder `/var/tmp/mcp-adapter-520` → `/var/tmp/mcp-adapter-700`.
7. `workflow-home.ts` line 15 left unchanged (still true).
8. Canary's refusal of a Pi below 1.0.0 left as is (not raised to 1.4.0).
9. `InputSource` comment cites D-CF1-01, not D-CF1-02.
10. TDD red step not committed separately (red state is a typecheck error the hook rejects); failure output is in the SUMMARY.
- Parent follow-ups: CHANGELOG `[Unreleased]` line needs ` (#NNN)` when the PR opens; CONVENTIONS.md fallow-ignore count.
#### 01-01 (Pi and companion version raise, adapter 7.x escape)
1. Running as root, 128 unit cases, 38 cucumber scenarios and 1 integration case (AMIG-02) fail on any tree (permission-injection tests); commits ran npm test scripts through an `npm_config_script_shell` wrapper using `setpriv` to drop `dac_override`/`dac_read_search` (no hook skipped).
2. Commits ran with `NODE_OPTIONS=--max-old-space-size=6144` (ESLint out of memory on a cold cache).
3. Conformance alphabet raised to 5 tokens (nested `${B:-${A:-x}}` needs 5); ~5 s.
4. In the literal-path check every alphabet name is set so any leaked reference shows as a mismatch.
5. Stale-cache case tested by editing the cached adapter version to 5.2.0 rather than installing 5.2.0.
6. Only `TRIGGER` changed in `adapter-escape.ts` (zero mismatches remained).
7. `test/live-uat/mcp-adapter-canary.mjs` still pins pi-mcp-adapter 5.2.0 (outside the file list; no gate runs it).
8. VER-01 "lockfile matches" read as: the lock root mirrors manifest peer ranges and dev dependencies, e2e fixture lock excluded (flagged for the verifier).
9. GSD commit tool not used, so commit titles carry no plan IDs (project rule).

### DC-19: Phase 1 wave 2 executor choices

- **Phase / source:** executors for plans 01-03, 01-11, 01-12, 01-13, 01-14.
- **Severity:** Medium for the upstream-over-plan deviations (01-11 item 1, 01-12 items 3-4, 01-13 item 1) and the Pi workaround (01-03 item 2); the rest Low. **Status:** open.
- **Parent note:** executor prompts now point at a shared brief file (`executor-brief.md` in the session scratchpad) instead of repeating the common blocks, extending DC-17.

#### 01-12 (argument substitution core)
1. Parity oracle is tree-sitter-bash 0.25.1 via the research re-implementation; that Claude Code bundles an equivalent grammar is assumed, not verified. 9 known differences ($-lexing quirks, error recovery after unclosed quote/bracket) are kept in a residual table.
2. Error-recovery heuristics inferred from harness probes, not grammar source (e.g. "doesn't" gives `doesn`, as upstream does).
3. Deviation: `parseArgumentNames` keeps declared order; the cut to 64 and longest-first sort happen inside substitution with original indices, as in the binary. Phases 2 and 3 must pass its result to `substituteArguments` unchanged.
4. Deviation: the size cap (4,000,000) applies only when a value is filled, as upstream; the plan's "oversized body with empty args throws" case was changed.
5. Deviation: the nesting scan uses an explicit stack (recursion overflowed on `"$(` x3000, a DoS, T-01-20).
6. `variables` typed `Readonly<Record<string,string>>`; unknown keys ignored.
7. No separate RED commits (hook rejects them; tdd_mode false); RED counts in SUMMARY.
8. With `args` undefined, variables are still filled (plan must-have and binary), contrary to CONTEXT E1's "returned unchanged".
#### 01-13 (context injection core, prompt-shell spawn site)
1. Spawn-failure text follows upstream `MRr` (bare `[Error]\n<msg>`), not the plan's `Shell command failed for pattern ...` form.
2. Fenced ```! blocks found by an indexOf scan instead of upstream's regex (ESLint `sonarjs/super-linear-regex` rejects it); same output.
3. Windows timeout kills only the shell process (`child.kill`), no `taskkill /T` tree kill.
4. Windows Git Bash lookup scans absolute PATH entries for `git.exe` instead of `where.exe`; PowerShell executables (`powershell.exe` / `pwsh`) from the plan, unverified against upstream; PowerShell tool treated as off when the variable is unset (upstream reads a default-false flag).
5. A stopped run always waits the full kill grace (2,000 ms default, own choice) before resolving `interrupted`.
6. The runner request takes an already selected shell; the edge must call `selectPromptShell` itself.
7. `timeoutMs` and `killGraceMs` optional with defaults (plan listed them as required).
8. RED not committed separately (hook); evidence in `scratchpad/agent-01-13/red-task*.tap`.
9. Gate fits: extra non-zero-exit case in the tracer for branch coverage; no-shell-out docstring no longer repeats "exactly five files".
#### 01-14 (`:-` delegation to pi-mcp-adapter 7.x)
1. Task boundaries moved: the marker check, shared-row updates, stage/integration assertion fixes, and all serializer guards landed in Task 1 (else Task 1 is red with 344 mismatches).
2. Two unrequested serializer guards (a default that could complete a marker started by the preceding reference's value; a reference after a default ending in a partial trigger).
3. Base-URL names (e.g. `ANTHROPIC_BASE_URL`) in `url`/`headers` stay install-time, reading "deny-listed" as covering the value-dependent deny list.
4. OAuth clean rule keeps every old decision rather than the plan's literal per-reference wording (`team ${TEAM:-}` keeps `auth`).
5. No separate RED commits.
6. The unset-at-connect conformance variant also leaves plain references unset, modeled as `""` (existing residual).
7. Retitled the shared row `${PI_CM_A:-{}env:PI_CM_SECRET}` to test the delegated form; a new `{env:`-default row keeps the merged-run case.
8. `${CLAUDE_PROJECT_DIR:-x}` is now delegated; at user scope it reads Pi's exported `CLAUDE_PROJECT_DIR` at connect.
9. One file outside files_modified changed: a one-line assertion in `test/bridges/mcp/stage.test.ts`.
- Parent follow-up (01-09): CHANGELOG line "A plugin MCP setting `${NAME:-default}` now takes a variable you set after install, as in Claude Code, without a reinstall."
#### 01-11 (declared component paths replace their folder, D-CF1-06)
1. A declared `.` still triggers the shadowed-folder warning (upstream `lKn` checks `(S+sep).startsWith(folder+sep)`), against the plan's Task 2 behavior bullet. With `commands: "."` Pi's recursive commands walk still reads `commands/`, so the warning claims more than Pi does (matches what upstream prints).
2. `""` now declares nothing (strict resolver and lenient map), following upstream's truthy check; before it resolved to the plugin root.
3. The warning names the bare kind; upstream's `experimental.<kind>` variants and its "Remove ... from plugin.json" hint not ported.
4. Update adds the warning only to its `updated` outcome; a failed update does not carry it.
5. The second lenient seed in `info.ts` (warm tree of a non-path source, reads no declarations) left alone: it still lists every conventional folder of an unavailable non-path plugin.
6. No separate red-only commits; red runs in SUMMARY.
- Edited outside files_modified: four tests relying on the old union (`install-flow-ledger`, `reinstall-flow`, `update-flow` PDEF-01 fixtures; `declared-component-path-overlap` architecture test).
- Parent follow-up (01-09): CHANGELOG sub-bullet as given in 01-11 SUMMARY.
#### 01-03 (harness tracer: profile Pi, scripted model, companions, skill seed)
1. jiti cache link: `{home}/tmp/jiti` links to `<run root>/jiti-cache` (outside the sandbox home, inside the run's temp root; compiled sources only) to cut profile Pi start from 13-20 s to ~1.4 s. Threat Flag.
2. Rule 1 fix: the scripted model registers via `pi.registerProvider("faux", { apiKey: "scripted-model", ... })` because Pi's `findInitialModel` keeps a saved model only for an already-configured provider (1-in-6 "No API key" flake after a new session). Works around Pi behavior; may need revisiting.
3. `PiProcess` now cancels every dialog, including one outside a request (shared Pi changes slightly).
4. `companions.ts` created in Task 1 (needed earlier); `model.steps.ts` edited in Task 2.
5. Unused-step message wording: "no model call used these steps of the model script".
6. Self-chosen formats: script table columns, call-row formats (`tool call <name> <json>`, `<tool> returned|failed: <text>`), derived `systemPrompt`.
7. Proven only by design, no scenario: "no script armed", HAR-03 `handled` path, live-pid stand-in check, companion reordering.
8. Companion load check uses commands, not tools (tools wait for the 01-04 registry probe).
- Parent follow-up (01-09): the cucumber world rule should mention the jiti cache link and the literal-key registration.

### DC-20: Phase 1 wave 3 executor choices

- **Phase / source:** executors for plans 01-04, 01-05, 01-06, 01-07, 01-08.
- **Severity:** Medium for 01-07 item 1 (trust observed through a run because pi-subagents lists untrusted agents) and 01-06 item 4 (new launch-environment extension outside the file list); the rest Low. **Status:** open.
- **Cross-cutting:** profile Pi starts timed out at 30 s under heavy parallel load; 01-04 added `PROFILE_PI_START_TIMEOUT_MS = 90_000` and 01-07 a 60 s untrusted start. Hook and workflow agents saw unexplained one-off timeouts before that fix.

#### 01-08 (workflow seed)
1. Deviation: the fixture workflow returns text, not a small object (the engine's progress entry shows any object only as `Structured result`, so it could not be compared whole).
2. The result Then also compares `error` (expected absent) and checks one run id.
3. The run When fails on any scripted-model call (stricter than the model-turn When); Phase 7 may need to relax it for workflows that call agents.
4. Statements reordered in the run When to clear a fallow clone match with `session.steps.ts` rather than adding a marker.
5. Whole-suite runs ended 1160/1161 twice: a 30 s step timeout in `Given pi runs with the scripted model and these companions:` while a profile Pi started, in a different scenario each time, under load average 20-26 on 4 cores. Attributed to load, unconfirmed. Suggested fix if it repeats: a named profile-Pi start timeout above 30 s.
6. Step texts are the agent's own wording (kind-prefixed per D-08).
#### 01-04 (registry probe, slash-command seed)
1. Rule 3 fix outside files_modified: `PROFILE_PI_START_TIMEOUT_MS = 90_000` exported from `world.ts` and applied to the two profile-start steps in `model.steps.ts` and `companion.steps.ts` (owned by 01-07 this wave). Cause: per-worker cold TypeScript compile took 27-30+ s under load average 20-31. Not confirmed on the base tree.
2. Probe records also carry `path` (where Pi says a tool/command came from), beyond the plan's "name and source", for later phases.
3. The listing Then compares only prompt-template commands (whole set), not every command.
4. A missing description shows as an empty cell (indistinguishable from empty).
5. Two field shapes never seen live (`null` description, empty `activeTools`); schema covers both.
6. The probe's own command `pi-registry-probe` appears in every profile Pi's command list; later whole-list comparisons must expect it.
7. Feature description names "a registry probe" as the stand-in.
- Parent follow-up (01-09): add `PROFILE_PI_START_TIMEOUT_MS` and the probe steps to `.agents/skills/cucumber/rules/world-and-stand-ins.md`.
#### 01-05 (hook recorder, hook seed)
1. `CLAUDECODE` recorded too (plan says `CLAUDE_*` only); the bridge sets `CLAUDECODE=1` for every hook (SENV-01).
2. Environment-variable names used as table headers (not lower-case words as the feature rules ask).
3. Run row is 13 columns wide (one row per run, per plan).
4. Seed expects an empty `transcript_path` (current bridge behavior; upstream always sends a path).
5. Two of the first three two-hook runs failed unexplained (output not captured); next 18 passed; guessed load/startup timeout.
6. The hooks Given takes a table (name/event/matcher) instead of one event and matcher.
7. Hook names limited to `[a-z0-9-]+` (inserted unquoted into the shell command).
8. Task 2 has no commit (checks passed).
- Findings for the Hooks phase (not decided): empty `transcript_path` on the first turn (upstream always sends one); the bridge runs matching hooks sequentially in declared order (upstream: parallel); the bridge does not dedupe duplicate hook commands (upstream does).
#### 01-07 (agent seed, trusted/untrusted pair)
1. Deviation: HAR-06 trust pair observes a project-scope agent RUN, not the `subagent {action:"list"}` listing, because pi-subagents 0.84 lists an untrusted project's agents (`discoverAgentsAll` with no trust option, `src/extension/index.js:511`) while runs follow Pi's trust. Looks like a pi-subagents defect; Claude Code's behavior for agents in an untrusted project still needs research before the agents phase. Coverage D2 marked `human_judgment: true`.
2. Both scenarios use `agentScope: "project"`, so the pair proves pi-subagents' explicit trust check, not its default discovery filter (an unscoped run's error lists built-in agents with node_modules paths and em dashes).
3. New `{uuid}` token in model-call steps (pi-subagents mission id varies); accepts any UUID, no same-id check. 01-09 should add it to `features.md`.
4. `UNTRUSTED_START_TIMEOUT_MS = 60 s` on the untrusted Given (timed out at 30 s under load; Pi loads extensions twice when a trust decision is needed; 12.9 s alone).
5. The child system-prompt comparison pins pi-subagents 0.84.0's instruction text; a peer upgrade that rewords it breaks the seed.
6. The trusted companions Given passes `trust: "trusted"` explicitly via a shared helper.
7. HAR-06 flagged assumption carried: 01-06's approval Given covers MCP approval.
8. No WINDOWS ledger entry (shared file across worktrees).
#### 01-06 (MCP stub, MCP seed, project-server approval, connect-time `:-` scenario)
1. Step order differs from the plan: install runs in the shared Pi before the profile Pi starts, with no new-session step (with the plan's order `new_session` binds the extension twice and the adapter's startup listing ran 2-3 times, so whole-log comparison was unstable).
2. New Given waits for the adapter's startup tool listing (50 ms poll, 15 s deadline).
3. `{tool call <n>}` projection local to the stub-log Then (Pi invents a tool call id per call); not in the cucumber skill's run-token list; 01-09 should reconcile.
4. New file outside files_modified: `features/lib/pi-launch-environment.ts`, a Pi extension loaded via `PiProfile.extraExtensions` that copies `<home>/pi-launch-environment.json` into the profile Pi's `process.env` (world.ts passes only TMPDIR). A world-level `environment` field on `PiProfile` would be cleaner.
5. Expected stub log includes the adapter's startup listing (two connections per call scenario); changes if a later adapter caches differently.
6. Task 3 Given text holds `"${PI_CM_STUB_TAG:-install-default}"` literally (escaped brace) so the acceptance grep finds it.
7. The stub logs its plugin and server names from its arguments (unrequested).
8. FG-29 not decided.
- Measured: A7 yes (nested call emits its own tool_execution records, id = outer id + `/1`); A5 adapter 7.0.0 reads `getAgentPath("mcp-adapter.json")` under `PI_CODING_AGENT_DIR`.

### DC-21: Phase 1 wave 4 executor choices

- **Phase / source:** executor for plan 01-09 (CI shards, phase gate).
- **Severity:** Low. **Status:** open.
- **Phase gate (on 80f1764, root wrapper):** `npm run check` exit 0 (cucumber 1169/1169); `test:e2e` 33 tests, first run 1 flake (ADET-01), next two full runs pass; `test:cucumber` twice 1169/1169 (seeds 641302, 717293).

#### 01-09 (CI shards, handed-over lines, phase gate)
1. CI shard timeouts (15 min each, the floor) rest on local runs doubled, not a CI measurement (CI-01 flagged assumption); re-measure on the first CI run and after each component merge.
2. The session `GH_TOKEN` is invalid, so zizmor's online audits could not run locally; commits ran zizmor offline (no findings). CI's Lint workflow runs the online audits.
3. CONVENTIONS.md (fallow-ignore count: 41 stated, 48 counted under extensions/test/scripts plus 3 in features/) and STACK.md (CI paragraph lacks the `behavioral` job) not edited (outside file list).
4. The D-CF1-06 CHANGELOG line drops the handed-over sentence about `skills` (one-sentence rule).
5. `layout.md` frozen list: every `features/lib/` file except the six fixture writers.
6. `staging-warnings.feature` named a lifecycle file.
7. PROJECT.md rows use semicolons as separators, matching existing rows.
8. e2e verdict counts the third full run; the first full run had one flake (`ADET-01` sentinel still alive after the 2 s wait, `test/e2e/adapter-detection-rpc.test.ts:452`), passing 3/3 alone and in the next two full runs.
9. Existing `uses: $/.github/workflows/sonarcloud.yml` line in ci.yml left as on origin/main.
- Parent follow-ups: phase-specific findings listed in 01-09-SUMMARY (Phase 4: `convert.ts` `THINKING_VALUES` lacks `max`; pi-subagents `list` ignores trust. Phase 5: three hook findings. Phase 6: FG-29, startup listing in the seed log. Phase 7: the run When fails on any model call).

### DC-22: Phase 1 verification, review, and human-item resolution

- **Phase / source:** parent, Phase 1 verify:post hooks, code review, verifier.
- **Severity:** Medium (items A and B below); the rest Low. **Status:** open.
- **A. Human items resolved without the user.** The verifier returned `human_needed` with two items. (1) CI shard timing: the parent dispatched `ci.yml` on the branch (`workflow_dispatch`, run 41283935457, all 8 jobs green); lifecycle job 3 min 21 s, components 1 min 34 s, so the 15-minute timeouts hold with more than 4.5x margin; `ci.yml` and the D-CF1-16 row now carry the measured figures. (2) HAR-06 observation change (trust pair observes a project-scope agent run, not the list): accepted by the parent under the standing "decide, do not interrupt" instruction; it is a choice of test observation, not an upstream divergence. VERIFICATION.md was set to `passed` with a resolution section and a recomputed fingerprint.
- **B. Code review scope and loop.** One reviewer at standard depth over 56 of 113 changed files (source, harness, CI, scripts; tests, feature files, docs left to the gates). Three fix rounds (the cap); no fourth review after round 3.
- **C. Skill runners.** `validate-phase` and `secure-phase` ran as general-purpose subagents (no Agent tool, so the security auditor ran inline); `code-review` ran in the parent.

#### validate-phase (Nyquist audit, phase 1) — compliant, 0 gaps
1. "Feedback latency < 60s" sign-off box left unchecked (the wave gate is ~10 min by design) while `nyquist_compliant: true` is set; each task command is under 60 s.
2. The 4 Manual-Only rows (CI shard wall time, real PowerShell, live adapter 7.0.0 canary, package legitimacy) accepted, not treated as gaps.
3. Reused the merged-tree check/e2e/cucumber results instead of re-running.
#### secure-phase (threat audit, phase 1) — 43 threats, 0 open (34 mitigated, 9 accepted as AR-01-01..10)
1. The runner had no Agent tool, so it did the gsd-security-auditor's work inline (allowed at ASVS L1 with zero open threats).
2. T-01-22 and T-01-24 closed for what Phase 1 built; the edge wiring (substitution before injection, errors via notification-dispatch, user-invoked only per D-CF1-03) carries forward to Phases 2 and 3.
3. T-01-41 (CI timeout) closed on an estimate; re-measure on the first CI run.
4. T-01-SC written as one row (high/mitigated for 01-01 and 01-15, low/accepted elsewhere).
5. Plain `git commit` instead of the helper (would title `docs(phase-01)`).
#### code review (phase 1): 0 blocker, 5 warning, 4 info; fixer fixed WR-01..05
- Review scope limited to 56 source/harness/CI files of 113 changed (tests, features, docs excluded; gates cover them). The upstream oracle for the tokenizer is the research's tree-sitter-bash 0.25.1 re-implementation (assumed equivalent to Claude's grammar). Info items IN-01..IN-04 not fixed (out of fix scope): residual table omits common differences such as `100% coverage`; blanket fallow export suppressions on the six cores have nothing forcing removal; exact `pi-ai` 1.4.0 dev pin may drift from the `pi-coding-agent` pin; a `!` command whose background child holds stdout blocks until the 120 s timeout (upstream behavior unchecked).
- Fixer: worked in the main checkout (no node_modules in a fresh worktree); zizmor run offline (invalid session GH_TOKEN); two `\$` error-recovery cases kept as residuals; untrusted start budget 180 s (2x trusted); upstream's "Skill /<name> requires bash..." text kept even for commands; new oracle rows in `UPSTREAM_ROWS`.
- Review round 2: WR-02..05 resolved; WR-01 fix regressed `x="a"\$ b c` (pre-command assignment); IN-05 new (`x $\$5 y`).
- Fix round 3 (cap): guard added (0 regressions on 53,248-input grid); IN-05 ported via `[\p{Alphabetic}\p{Nd}]` found by probing 120 characters (scanner source not read); one punctuation input traded (`$\$ b; c'`, error recovery after an unclosed quote) recorded as a residual; 11 unbalanced-bracket/quote `$\$` cases left under the best-effort clause. Parent did not run a fourth review pass after the third fix (iteration cap reached); the tokenizer has no production caller yet, and the full gate re-ran on the result.

### DC-23: Phases 2-7 run sequentially in this session, not as six parallel sessions

- **Phase / source:** parent, after Phase 1.
- **Severity:** Medium. **Status:** open.
- **Decision:** ROADMAP plans Phases 2-7 as six parallel sessions and worktrees, each on its own branch, merged by the parent in the order 7, 6, 4, 2, 3, 5. This session may push only to `claude/quirky-planck-hhm592`, and its background subagents have no Agent tool, so they cannot run the GSD phase pipelines (researcher, planner, checker, executors, verifier). The parent instead runs Phases 2-7 one after another in numeric order on the milestone branch, each through discuss, plan, and execute, with the plans of one wave still running in parallel worktrees. The merge-order rationale (conflict avoidance between parallel branches) no longer applies; each phase starts from the previous phase's merged tree, so a later phase sees an earlier one's files. File-ownership rules still hold, so phases stay out of each other's files.
- **Also:** the Phase 1 transition runner marked D-CF1-06/07/08/13/14/15/16/17 `✓ Good` and kept the rest `-- Locked`; STATE.md frontmatter was hand-corrected after `phase.complete`.

### DC-24: Phase 2 (Skills) discuss decisions settled without the user

- **Phase / source:** Phase 2 smart discuss (`02-CONTEXT.md`, D-CF2-01..12).
- **Severity:** Medium (items 1-4); the rest Low. **Status:** open.
- **Upstream probes:** live, offline, against Claude Code 2.1.316 (local marketplace, throwaway HOME/CLAUDE_CONFIG_DIR, `env -i`, and a local HTTP stub with a dummy key to capture the model request; no credential, no LLM). The binary contradicts the docs on FG-07 and FG-08.
- **Items:**
  1. **D-CF2-01/02 (FG-07):** the Pi name stays `/skill:<plugin>-<dir>` (the binary keeps the directory name and adds frontmatter `name` as aliases, `Qqn` at byte 287674833). Aliases become exactly upstream's: `<plugin>:<dir>` (non-`[a-zA-Z0-9_-]` to `-`), `<plugin>:<fm name>`, and the bare `<fm name>`. The elided alias reverse-derived from the Pi name (e.g. `acme:foo` for directory `acme-foo`) is DROPPED, which a user may rely on today. Bare-name collisions across plugins were not probed.
  2. **D-CF2-03 (FG-08):** inside one plugin a command wins over a same-named skill (binary; the docs table suggests the opposite). The skill is not staged and install WARNS, a warning upstream does not print; before, the skill stayed reachable as `/skill:`.
  3. **D-CF2-05 (FG-09):** the alias and skill invocation also run for `rpc` input (upstream `-p` mode resolves the names), superseding SK-6's "interactive" wording; `extension` input passes through.
  4. **D-CF2-10:** the Pi gap report (no hide-from-`/`, no skill display name/alias, no hook on the model's own skill path) is drafted as ready-to-file text in the phase SUMMARY, not filed; the ROADMAP's "reported to Pi" criterion needs the user to file it.
  5. **D-CF2-06:** the Phase 1 cores are wired into `edge/skill-aliases.ts`; Pi's `<skill>` block framing is kept instead of upstream's `Base directory for this skill:` text.
  6. **D-CF2-12:** Phase 2 ownership widened to `orchestrators/skill-alias-state.ts` (+ test) and an optional, backward-compatible profile in `features/lib/pi-tui.ts` (a frozen-list file? `pi-tui.ts` is not in the frozen list).
  7. **D-CF2-04, 07, 08, 09, 11** pin earlier decisions (first-wins with `skills/` copy winning, upstream `A2e` description fallback, dropped-field warnings, `user-invocable: false` stays listed under D-CF1-09, lifecycle in a new session after `/reload`).

### DC-25: Phase 2 research open questions and pattern-map choices

- **Phase / source:** Phase 2 researcher (`02-RESEARCH.md`) and pattern mapper (`02-PATTERNS.md`); parent answered the open questions with the recommended option.
- **Severity:** Low-Medium. **Status:** open.
- **Open questions answered by the parent (planner told to follow these):**
  1. Skills staged by older installs carry no names key: they keep today's elided-suffix alias as a fallback until re-staged (a non-upstream alias kept for compatibility).
  2. Within one plugin, a skill's identity alias (`<plugin>:<dir>`) wins over another skill's frontmatter alias with the same text (not probed upstream).
  3. A bare alias that equals a Pi built-in command name is recorded as a residual (Pi exports no built-in list).
  4. Autocomplete keeps offering qualified aliases only, not bare ones.
- **Research choices:** stored alias names live in a JSON-valued frontmatter key of the staged `SKILL.md`, written after `rewriteMarkdownReferences` (not a sidecar file); this changes expected values in three tests outside Phase 2 ownership (`test/edge/register.test.ts`, `test/orchestrators/plugin/materialize-latest.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`). The D-CF2-04 `skills/`-first fix goes in `bridges/skills/discover.ts`, not the resolver. Aborted invocations report as `usage-error` with origin `{kind:"command", commandId:"skill"}` (stretching an existing kind to avoid closed-set edits). The TUI scenario holds its session inside one `When` step and edits `features/lib/pi-tui.ts` (not on the ROADMAP frozen list; D-CF2-12). `[ASSUMED]`: `${CLAUDE_EFFORT}` reads `low` in the profile Pi; upstream does not normalize command names; upstream trims typed arguments.
- **Pattern-map suggestions:** `skill-invocation.ts` returns a discriminated `{ok|abort}` result instead of throwing; `loadQualifiedSkillAliases` widens its return type to carry `pluginRoot`/`pluginData`.

### DC-26: Phase 2 planning choices

- **Phase / source:** Phase 2 planner (`02-01..07-PLAN.md`) and plan checker (0 blockers, 1 warning, 2 info).
- **Severity:** Medium (items 1-3); the rest Low. **Status:** open.
- **Items:**
  1. **Four waves, not the template's three:** the alias plan (02-06, SKL-05) needs 02-03's RPC-capable input handler and shares `edge/skill-aliases.ts`, so it moved to wave 3 and the gate to wave 4.
  2. **Out-of-ownership edits:** expected-value edits to four tests outside Phase 2 (`test/edge/register.test.ts`, `test/orchestrators/plugin/materialize-latest.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`, `test/architecture/declared-component-path-overlap.test.ts`), each limited by a `git diff` criterion.
  3. **`features/lib/pi-tui.ts`:** 02-06 adds optional profile fields, extra CLI args, a ready text, and a raw `typeText` method (Tab completion needs it), beyond D-CF2-12's wording; `world.startTuiSession()` stays unchanged. The TUI step rebuilds the run's git environment from public world getters.
  4. **Names record in wave 1:** a `pi-claude-marketplace` JSON frontmatter key (names, pluginRoot, pluginData) is written by 02-01 before its consumers; the supporting-Markdown pass now skips the skill's own top-level `SKILL.md`. Absolute plugin paths in it are an accepted disclosure (T-02-03; the staged body already holds them after SUB-01 substitution).
  5. **Seed module moved:** `features/step_definitions/skill/invocation.steps.ts` (Phase 1 seed) is deleted and its Given moves to `skill/listing.steps.ts`; the frozen cucumber layout rule still names the old module (parent line).
  6. **02-01 is large** (15 files, 3 tasks); checker warning accepted as in Phase 1 (mostly source-test pairs and expected-bytes edits).
  7. **Smaller:** whitespace-containing frontmatter `name` stores no alias (D-CF2-02 residual); a `/skill:<name>` counts as bridged when its file is under this extension's staged-skills dirs (orphans count too); a new setup Given in 02-04 (`... which skipped a skill of the plugin`); typed `${CLAUDE_*}` arguments proven by unit tests only (frozen run-token expansion rejects `{...}`); 02-05 pins existing lifecycle behavior with negative-edit proofs instead of red proofs; `docs/env-vars.md` and the PRD's SK-6 wording are parent lines.
  8. **Gate tooling:** the plan:post gap-analysis check reported all 58 milestone requirements uncovered (including completed Phase 1 ones), so it was treated as a tool misread; requirement and decision coverage were confirmed by the checker and `check.decision-coverage-plan` (12/12).

### DC-27: Phases 3-7 fan out to parallel child sessions (supersedes DC-23)

- **Phase / source:** parent, after the user approved parallel sessions on `features/` branches and pushing to origin (2026-11-01).
- **Severity:** Low. **Status:** open.
- **Decision:** Phases 3-7 each run in their own Claude Code cloud session on `features/component-features-phase-{3..7}`, branched from the milestone head `cf00b31` (Phase 1 complete, Phase 2 waves 1-3 merged; Phase 2's last plan finishes on the milestone branch in parallel). Each child runs `gsd-autonomous --only N`, follows `.planning/CHILD-SESSION-BRIEF.md`, keeps its own `P{N}-DC-NN` log in its phase directory, and lists CHANGELOG/README/PROJECT lines as parent lines. The parent merges the branches in the ROADMAP order (7, 6, 4, 3, 5, after Phase 2), runs `npm run check` on each combined tree, applies the parent lines, and folds each phase log into this file. Branch names follow AGENTS.md (`features/*`), not the ROADMAP's unnamed per-phase branches.

### DC-28: Phase 2 executor choices

- **Phase / source:** executors for plans 02-01..02-07 and the parent's post-merge fix.
- **Severity:** Medium for out-of-ownership edits (02-01, 02-03, 02-04) and the worktree hook finding; the rest Low. **Status:** open.

#### 02-01 (listing, description fallback, stored names record)
1. Edited three files outside Phase 2 ownership: `features/plugin/install-dependencies.feature` and `features/plugin/update-dependencies.feature` (expected staged SKILL.md text now includes the record line, with `{home}`/`{project dir}` tokens), and the step "the staged skills directory of the {word} scope holds these files:" in `features/step_definitions/plugin/installation.steps.ts` (now converts sandbox paths to run tokens before comparing).
2. `readSkillRecord` left unexported (fallow fails an unused export); 02-03 and 02-06 add `export` when they import it.
3. A list-valued frontmatter `name` stores no alias (upstream would comma-join it; avoids ESLint `no-base-to-string`); a mapping gives none either way. Upstream list behavior unchecked.
4. Whitespace-containing name stores no alias (planned D-CF2-02 residual).
5. `commandUpstreamNames` treats an un-`lstat`-able command file as no command; a directory error other than missing/not-a-directory now fails during the skills step instead of the commands step.
6. No separate red commit for Task 3 unit tests (hook); the Task 1 cucumber run is the recorded red proof.
7. Listing tables assume Pi's alphabetical order (`/skill:demo-<dir>` before `/skill:demo-skill`).
8. A stage-test input changed to `pluginRoot: "/plugin"` so the expected YAML error excerpt does not depend on the temp path.
- Parent lines: `.agents/skills/cucumber/rules/layout.md` still names `skill/invocation.steps.ts` (now `skill/listing.steps.ts`).
#### 02-05 (skill lifecycle, SKL-06) — pins existing behavior, no product change
1. Idempotency and concurrency not re-proved (left to existing plugin features and the concurrent-install integration test).
2. Uninstall checked through the listing only, no model-side scenario.
3. Update scenarios re-offer the whole plugin at 1.1.0, so both listing rows change and are compared.
4. Tracer gate auto-continued (unattended, no `gate` attribute).
5. The alias half of D-CF2-11 is left to 02-06.
#### 02-02 (frontmatter variants, D-CF2-08 dropped-fields warning)
1. The RED commit guessed a `warning` cascade row; the real row is `info`. The GREEN commit corrected it and the red proof was re-run with the corrected table.
2. No TAP red for unit cases (hook); shown by reverting `stage.ts` locally.
3. D-CF1-09 named in scenario titles by meaning ("because pi cannot hide a skill's slash command"), not by ID.
4. Dropped-field names match case-sensitively (`Model:` is not reported); upstream unchecked.
5. The new system-prompt skill-list step fails when Pi writes no `<available_skills>` block.
6. Only `install` has a scenario for the dropped-fields line, though update/reinstall/enable/apply/cascades also show it (discovery channel).
7. Unit cases use `{kind:"discovery", message}` literals rather than calling `discoveryWarning(...)`.
8. Arbitrary fixture values in the all-eight-fields scenario (keys only are read).
- Environment: a commit attempt was OOM-killed during the hook's parallel lint under load; warming the ESLint cache with a lone `npm run lint` fixed it.
#### 02-04 (name clashes, D-CF2-03/04)
1. Scenario title reworded ("Prompting /demo:clash ...") because the feature gate rejects titles starting with `/`.
2. Expected value edited in out-of-ownership `test/architecture/declared-component-path-overlap.test.ts` (planned, DC-26 item 2).
3. Removed the skills-side `fallow-ignore-next-line code-duplication` marker (its clone group vanished), leaving the commands-side marker at `bridges/commands/discover.ts:314` orphaned in a Phase 3 file; CONVENTIONS.md marker count drifts further.
4. The command check runs before generated-name dedup, so a skipped skill frees its generated name (`clash/` skipped lets `demo-clash/` install); not checked upstream.
5. Names compare exactly, no case folding (research A4, unchecked upstream).
6. Expected model text for `/demo:clash` with no args measured from Pi (`COMMAND CLASH BODY`).
7. MANF-03 trailing-separator unit case: expected `skillDir` lost its trailing separator (skills folder now reached first).
8. No TAP red for unit cases (hook); cucumber red proofs recorded.
- Parent lines: delete the orphaned commands-side clone marker after `npx fallow dupes` passes (Phase 3 or parent); object-map `commands` (FG-13) not clash-checked, re-check at Phase 3; `stage.ts` still calls `commandUpstreamNames` so commands folders are read twice; a commands-dir read error other than ENOENT/ENOTDIR now fails `discoverGeneratedNames` before the ledger opens.
#### 02-03 (skill invocation: substitution, injection, abort; T-01-22/24 closed)
1. Missing peer cache in the worktree filled with `node scripts/install-test-peers.mjs` instead of halting on the precondition.
2. Rule 1 fix: skill directory from `dirname(sourceInfo.path)`, not `sourceInfo.baseDir` (Pi sets `baseDir` to the extension's dir for extension-contributed skills, so "References are relative to" was wrong).
3. Abort origin `commandId: "skill"` is new to JSON consumers; `docs/json-output.md` does not list it yet (parent line).
4. Every non-extension slash token reads `pi.getCommands()`; a bare token loads the alias table for its cwd; a bare alias equal to a Pi built-in is not reserved (DC-25 item 3 residual).
5. `CLAUDE_PROJECT_DIR` set only for project-scope skills; user-scope keeps the literal.
6. Arguments are the trimmed rest of the line after `/^\/(\S+)(?=\s|$)/`; Pi's native expansion splits at the first space only, so a tab/newline after the token behaves differently.
7. The frozen core escapes `` !`cmd` `` in an argument as `` \! `cmd` `` (with a space), not the plan's spelling; tests state the observed text.
8. An acceptance grep (`ThinkingLevel|InputSource` count 0) prints 1 because of the required `pi.getThinkingLevel()` call; no type imported.
9. Exported `readSkillRecord` and rewrote its doc sentence in `skill-names.ts` (outside files_modified).
10. Some Task 2 scenarios passed before the product change (Task 1 shipped substitution); only injection/abort failed first.
11. No WINDOWS.md entry.
- Measured: `${CLAUDE_EFFORT}` is `low` in the profile Pi; the abort payload arrives over RPC immediately; importing the cores did not make any `.fallowrc.json` entry stale.
- **Tooling finding:** inside `.claude/worktrees/...` the commit hook printed "(no files to check)" for `npm run check:commit` and prettier, probably because `.pre-commit-config.yaml`'s top-level `exclude: \.claude/(?!skills/)` matches worktree paths. Executor commits in worktrees may therefore skip the npm-check hook; the post-merge `npm run check` on the main checkout is the backstop.
- Parent lines: Phase 3's `edge/command-invocation.ts` handler now receives text starting with `<skill name=` after a successful skill invocation and must ignore text not starting with `/` (Pitfall 10).
- **Post-merge gate fix (parent, wave 2):** `test/orchestrators/plugin/discover-names.test.ts` (outside Phase 2) failed after merge because its fixture gave a plugin same-named commands and skills, which D-CF2-03 now shadows; the parent renamed the fixture skills (`alpha-guide`, `zeta-guide`) in commit b89e2e3. Plan 02-04 had not run the full unit suite.
#### 02-06 (skill aliases from stored names, TUI Tab completion)
1. `loadQualifiedSkillAliases` takes `Partial<SkillAliasDependencies>` merged over defaults.
2. TUI readiness text is `[Extensions]` (Pi prints it after binding extensions and installing autocomplete); breaks if a future Pi stops printing its loaded-resource list.
3. The step relies on the trailing space Pi's completion adds before typing `Ada`.
4. The step waits for the `→ ` menu marker then the redrawn prefix.
5. TUI scenario omits the "new RPC session" Given (fresh Pi process).
6. Shared-name rule split into two scenarios (bare, qualified) with a Background.
7. Command-clash, unclaimed, disable and enable scenarios pass on the old loader too (guards).
8. The legacy shortened-alias fallback also covers a malformed or hand-removed record.
9. Bare-alias claims across two plugins and case sensitivity not checked upstream (loader order, exact match).
10. Hook skipped in the worktree; agent ran check:static, test:modules and full `npm run check` (1219 scenarios).
- Parent lines: CHANGELOG "Skill aliases now match Claude Code: `/<plugin>:<skill dir>`, `/<plugin>:<frontmatter name>`, and the bare `/<frontmatter name>`. The shortened alias with the plugin prefix cut from the directory name (such as `/acme:foo` for `acme-foo`) is gone; skills installed before this release keep it until you update or reinstall their plugin."; PRD SK-6 wording update.
#### 02-07 (phase gate, Pi gap report, parent lines)
1. One SUMMARY commit for three SUMMARY-only tasks.
2. Stale code-duplication markers left in place (cover no clone group): `bridges/skills/stage.ts:496`, `bridges/commands/stage.ts:276`, `bridges/commands/discover.ts:314`; CONVENTIONS.md counts stale (says 41 total / 30 code-duplication; real 47 / 29). Parent decides.
3. All six `.fallowrc.json` `dynamicallyLoaded` and core `ignoreExports` entries can be removed now (measured: `npm run fallow` exits 0 without them); SUMMARY keeps "after Phase 3" as main advice.
4. CHANGELOG lines omit the 100-char cut, the `when_to_use` fold, and non-install verbs showing the dropped-fields warning; invocation change split into two sub-bullets.
5. Invented README example `name: baz`.
6. `docs/env-vars.md` calls `CLAUDE_SESSION_ID` pi-only, but `${CLAUDE_SESSION_ID}` in skill content is a Claude Code token; flagged for the parent's wording.
7. Decision-row outcomes: D-CF2-10 "Pending (user files)", D-CF2-12 "Good", the rest "Locked".
8. Pi gap report proposals are the agent's own; tracker URL from the SSDEDUP-01 backlog entry. Drafted, not filed.
9. `${CLAUDE_EFFORT}` = `low` measured with the faux model only.
- Gate (cf00b31, wrapper): `npm run check` exit 0 (cucumber seed 239193, 1219/1219); `test:cucumber` twice 1219/1219 (seeds 986925, 847603); `fallow dupes` exit 0.

### DC-29: Phase 2 security, validation, and code review

**Decision for the user to review: D-CF2-13, taken by the parent without asking.** Review round 2 found that a cloned repository can ship its own staged skills under `.pi/pi-claude-marketplace/` and get `!` commands run when the user types one of those skill names. Pi 1.4.0 trusts such a project on its own (no trust-requiring files), and `state.json` sits in the same repository-controlled folder. The parent ported Claude Code's model: a user-scope record of project installs (`<agentDir>/pi-claude-marketplace/project-installs.json`, keyed by the real project path, with the SHA-256 of each staged `SKILL.md`). A project-scope skill with no matching entry gets no alias and aborts before any `!` command runs. This mirrors upstream `installed_plugins.json` and its `not_installed_here` skip.

#### secure-phase: 21 threats, 0 open (17 mitigated, 4 accepted AR-02-01..04)
1. The runner had no Agent tool, so the auditor work ran inline (allowed at ASVS L1).
2. Plain `git commit` instead of the GSD helper, whose `docs(phase-02)` title the commit rules forbid.
- T-01-22/T-01-24 are closed for skills; commands stay open until the Commands phase wires `edge/command-invocation.ts`.

#### validate-phase: compliant, 0 gaps
1. Reused the 02-07 gate plus targeted reruns; no full re-run.
- Manual-only: filing the Pi gap report (user); `shell: powershell` and the Windows "requires bash" path (unit-tested only); typed `${CLAUDE_PLUGIN_ROOT}` argument (unit-tested only).

#### Code review round 1 (1 blocker, 3 warnings, all fixed with scenarios and red proofs)
Indented `---` fence; record-key spellings; stale staged file falling through to Pi's expansion; untrusted project running `!`.

#### Code review round 2 fixes (CR-01, WR-01..03)
1. **The provenance ledger is written without a lock.** (Superseded: DC-30 item 4 moved it to one file per project, written under the project's state lock.) The skills bridge cannot import `transaction/`. Two concurrent project installs in different projects can lose one update; the failure is closed (that project's skills abort and ask for a reinstall).
2. **Discovery still lists a project skill with no ledger entry** in a project Pi trusts, so the abort message can name it. The model can still read its description and body, which upstream `not_installed_here` would hide. Same prompt-injection exposure as `AGENTS.md`.
3. **Existing project installs lose their skills until reinstalled.** A project-scope skill staged before this change has no ledger entry. Plain `apply` does not re-stage it; the user runs `/claude:plugin reinstall <plugin>@<marketplace> --scope project`. The CHANGELOG records this.
4. The provenance scenario models a clone by deleting the user ledger rather than forging `state.json`.
5. After WR-01 (discovery gated on `ctx.isProjectTrusted()`), the "Pi does not trust" abort is reachable only after a trust change within a session; unit tests cover it, no scenario. `features/skill/project-trust.feature` was rewritten because the behavior changed.
6. `topLevelNodeIndex` falls back to the plain `<key>:` spelling for a node that does not parse alone; as a side effect a record key written as a YAML alias is now replaced instead of failing the install.
7. `test/index.test.ts` answers `isProjectTrusted()` with `anyTimes()` in the shared helper.
8. Files outside Phase 2 touched: `index.ts`, `orchestrators/discover.ts`, and their tests; `install-flow-ledger.test.ts`.
- Parent line: the hooks bridge has the same pre-existing exposure; the Hooks phase should adopt the same provenance check.

### DC-30: Phase 2 code review round 3

**Decision for the user to review: D-CF2-14, taken by the parent without asking.** Round 3 showed that project-scope autoapply (AAP-01) let a load install a repository-declared plugin and write the D-CF2-13 ledger itself, so the skill's `!` commands ran on the next session. A load with autoapply on now applies the user scope only, whichever file turned the setting on, and shows the project scope's pending block. An explicit `/claude:plugin apply` still applies both scopes. Pi 1.4.0 gives the extension only `isProjectTrusted()`, which is also true for an auto-trusted project, so a load cannot tell explicit trust apart and never changes the project scope. Upstream parity: Claude Code needs the trust dialog and an install prompt. This changes AAP-01 behavior.

#### Fixer choices (10 findings fixed, each with a red/green proof; IN-04 and IN-05 left to the parent)
1. **D-CF2-14 scope:** reading Pi's `trust.json` directly was judged not an allowed route. A repository's project config can still turn on load-time apply for the user scope; how AAP-01 resolves the setting is unchanged. Users who explicitly trusted a project also lose load-time project apply. Re-exporting Pi's `ProjectTrustStore` through `platform/pi-api.ts` would restore it (parent line).
2. **D-CF2-14 ordering:** the user-scope apply now runs before the project's read-only pass, so the output is the apply cascade, then the project pending block. This departs from project-first ordering (MSG-GR-3), to keep one pending block when the apply step throws.
3. **IN-01:** `? name` followed by `: x` is read as `name` and rewritten, not refused, because Claude Code reads it that way.
4. **IN-06:** the ledger is now one file per project, `<agentDir>/pi-claude-marketplace/project-installs/<sha256(realpath)>/skills.json`, written under that project's state lock. This replaces DC-29 item 1 (the unlocked writer). It relies on every writer holding the lock (install-outcome, update-swap, `cascadeUnstagePlugin` checked). No migration: the D-CF2-13 layout was never released.
5. **WR-02:** an unreadable or unknown ledger now fails the write with `ProjectSkillLedgerError`. An `update` or `reinstall` against it reports "failed during physical replace"; the new files stay unrecorded and fail closed. No scenario.
6. **WR-03:** the digest covers every file and symlink in the staged skill directory, checked again at use time. Plugin-root files outside the skill directory and link targets stay unhashed (accepted risk; needs a threat-register ID). The provenance Background's skill now runs `sh ${CLAUDE_SKILL_DIR}/status.sh`, which assumes `sh`.
7. **WR-04:** uninstall, disable, and `marketplace remove` show the skills ledger warning as one `diagnostic` per plugin, header "N cleanup warning(s)" (wording invented). The install undo, cascade undo, orchestrated, and partial-failure arms still drop it.
8. **WR-05:** a frontmatter node holding the key with other keys (flow mapping) fails the install again, naming the skill, line, and keys. A writer called outside staging gives a generic message.
9. No scenario for IN-01, IN-02, or IN-06 (no user-visible change). The IN-06 FIFO unit test uses `mkfifo` (Linux/macOS only).
10. All findings marked "fixed"; the logic changes in WR-05, IN-01, and CR-01 may still deserve a human read.
- Parent lines: D-CF2-13/14 into CONTEXT and PROJECT; CHANGELOG lines (AAP change; existing project installs need a reinstall); the hooks phase adopts the per-project ledger; IN-04 update and enable scenarios; maybe a `docs/output-catalog.md` entry for the new diagnostic header.

#### verify-phase: human_needed, 4/5 (criterion 5 needs the user to file the Pi gap report)
1. `human_needed`, not `passed`: criterion 5 says the gap "is reported to Pi"; D-CF2-10 makes the filing the user's. `phase.complete` refuses until `/gsd-verify-work 02`; the parent recorded `verification_deferred_human` in STATE.md and continued rather than stop autonomous mode.
2. Path variables in a skill body (other than `${CLAUDE_SKILL_DIR}` inside a `!` command) are proven only by the verifier's throwaway probe, not a committed scenario.
3. Reused the parent's gate log (3bfaab5, exit 0) by timestamp.
4. Edits outside Phase 2's ownership list (`load.ts`, `uninstall.ts`, `enable-disable.ts`, `marketplace/{remove,shared}.ts`, `features/plugin/autoapply.feature`, `index.ts`) rated Info; re-verify after the Phase 3 and 5 merges. `index.ts` also withholds project prompt paths in an untrusted project, which affects Phase 3 (told).
5. `02-SECURITY.md` predates the review rounds: no entry for the ledger, D-CF2-14, or the WR-03 residual.

#### Parent lines (docs, decisions, scenarios)
1. Stale clone markers removed in the commands bridge too (Phase 3 files), since the merged tree confirms them; expect small conflicts when Phase 3 merges.
2. CHANGELOG adds a line no parent line asked for (untrusted-project discovery also leaves out prompt templates); the autoapply and reinstall lines are reworded.
3. PROJECT.md rows for D-CF2-01..14 are shortened; measured residuals stay in 02-07-SUMMARY and 02-CONTEXT. D-CF2-13/14 use a new outcome value, "Pending (user review)".
4. Threat IDs T-02-21..23 continue the register; T-02-23 is accepted as AR-02-05. T-02-17's row was not widened to match the code's use.
5. `docs/json-output.md` lists all three skill abort causes (untrusted project, unreadable file, missing install record).
6. README tables applied with the invented `name: baz` example from 02-07. No `docs/output-catalog.md` entry: the catalog lists no staging diagnostic headers.
7. CONVENTIONS marker listing corrected for pre-existing markers too (42 total, 24 `code-duplication`).
- Gate after these commits (7e5240e): `npm run check` exit 0, cucumber 1254/1254 (seed 311675).

### DC-31: Phase 7 (Workflows), merged at a28489b

Full entries: `.planning/phases/07-workflows/DUBIOUS-CHOICES.md`, P7-DC-01..17 (one High, eight Medium, eight Low). The child session ran discuss, plan, execute, three review rounds, and verification (passed 5/5) on `features/component-features-phase-7`. No production code changed.

**For the user to review first:**
1. **P7-DC-03 (High), D-CF7-01:** Pi runs a plugin workflow with no approval prompt. Claude Code asks first in manual mode. Neither the engine nor Pi gives the bridge a hook, so this is recorded as a Pi gap and the bridge adds nothing.
2. **P7-DC-02, D-CF7-02:** the engine passes typed arguments as an object `{_, _raw, key=value}`; Claude Code passes one string. Pinned as is.
3. **P7-DC-04, D-CF7-03 / D-CF7-04:** the bridge refuses nondeterministic or unparseable scripts at install (upstream registers them and fails at run), and installs a script with a bad `meta` with a warning (upstream skips it at load).
4. **P7-DC-06/13/16, WFL-04:** "engine loaded later, then `/reload`" is proven by adding the engine to Pi's settings and starting a new session, because over RPC `/reload` goes to the model. The verifier accepted it.
5. **P7-DC-15:** engine 3.15.0 never posts a run's result back over RPC and warns once per session; six run scenarios pin that warning.
6. **P7-DC-05:** commit trailers name the child session's link, not the parent's.
7. **P7-DC-17:** the child skipped the transition's PROJECT.md step; the parent adds D-CF7-01..04 and moves WFL-01..05 to Validated.
- Merge: clean auto-merge; the parent restored STATE.md's position block, which the child's copy had overwritten.

#### Phase 7 parent lines (applied by the parent at 12227bb..0b23370; `npm run check` exit 0, 1290/1290, seed 632189)
1. D-CF7-01..04 rows shortened like the D-CF2 rows, outcome kept `-- Locked`; WFL-01..05 moved to Validated.
2. The wrong install note ("the engine will refuse to load it", `bridges/workflows/discover.ts`) is user-visible but recorded as WFLNOTE-01, not fixed, because rewording it touches tests, the output catalog, and `refusals.feature`.
3. IN-08 (`field-rows.ts` join, 44 uses) and the world-side half of IN-06 went to BACKLOG (WFLHARNESS-01). IN-02 was applied: `DIALOG_METHODS` exported once from `features/lib/pi-process.ts`, which touches files frozen during the component phases; later sibling merges may conflict there.
4. IN-10 wording: "a `Then` that compares the whole of what a turn reports marks it compared"; the notices step still marks a run turn compared, which is arguable.
5. `layout.md` now lags ROADMAP's ownership paragraph by the extra Phase 7 test files.
6. Advisory review items IN-01/03/04/07/09 are not in BACKLOG (no parent line).

### DC-32: Phase 6 (MCP Servers), merged at e3a003d

Full entries: `.planning/phases/06-mcp-servers/DUBIOUS-CHOICES.md`, P6-DC-01..22. The child session ran discuss, plan (9 plans, 4 waves), execute, security (22/22 closed), validation, one review round (8 warnings, 7 fixed) and verification: **human_needed, 4/5**. The parent merged it without closing the phase and recorded `verification_deferred_human` in STATE.md.

**For the user to decide (blocks `/gsd-verify-work 06`):**
1. **D-CF6-10, SC4 / MCP-07:** no scenario shows an agent calling a plugin's MCP tool. pi-subagents 0.84.0 refuses it in a foreground run (`Unresolved MCP direct-tool selectors: ...`), and background children in the harness load neither the companions nor the scripted model (BACKLOG MCPBG-01). The refusal is pinned as a recorded gap. Accept the pin (override with your name) or reject it (needs a pi-subagents change and harness work).
2. **Symlinks in referenced MCP files (WR-01, WR-02):** a referenced `mcpServers` file refuses any symlink, even one inside the plugin root (MCPR-04, NFR-10). Claude Code follows it. The root `.mcp.json` follows symlinks anywhere, as upstream does. The refusal note says "escapes plugin root" for an in-root link, which is wrong either way.

**Behavior changes made for upstream parity (review these too):**
3. **P6-DC-01, D-CF6-01:** servers from `.mcp.json` and declared `mcpServers` now merge, later same-name wins. This replaces PRD MC-1 ("first match wins, no merge").
4. **P6-DC-02/07/18, D-CF6-02:** a malformed server in a file, or a missing, unparseable, or unreadable file source, is now skipped silently (debug log only); the plugin installs with the rest. Inline malformed servers and escaping references stay fatal. A permission-denied file is skipped instead of reported `{permission denied}`, and a transient read error (EMFILE, EIO) skips servers that a later update, apply or reload then removes (WR-03).
5. **P6-DC-03, D-CF6-03:** project-scope plugin servers keep pi-mcp-adapter's project approval; Claude Code never asks.
6. **P6-DC-07 item 5:** a reference without `./` stays installable; upstream refuses the manifest.
- Also unfiled: a drafted pi-subagents gap report (user's call). Parent lines pending: CHANGELOG, PRD MC-1..4, PROJECT D-CF6-01..11, four BACKLOG items, output-catalog and hooks-compatibility docs, the canary re-run on 7.0.0, cucumber skill notes, the migration message rewording.
- Merge: ROADMAP and STATE conflicts in the tracking tables only; the parent kept the milestone view.

#### Phase 6 parent lines (applied by the parent at 249c2ec..4b29a69; `npm run check` exit 0, 1376/1376, seed 278404)
1. D-CF6-01..11 rows shortened like the D-CF2 rows. The drafted `✓ Good` outcomes are kept, except D-CF6-10, which is `-- Pending (user review)`. MCP-01..08 are not in Validated, as SKL-01..06 are not while Phase 2 waits. The drafted REQUIREMENTS line (MCP-07 `[x]`, gap-pinned) and the ROADMAP SC4 rewording are not applied, because they would settle D-CF6-10.
2. CHANGELOG: the five sub-bullets are joined into one sentence each, and "A bad server written in `plugin.json` still blocks the install" is cut, because it is not a change. The `Internal:` behavioral-tests line still names workflows only.
3. PRD MC-1..MC-4 applied as drafted. The new MCP flowchart is the parent's drawing of the drafted merge.
4. `docs/hooks-compatibility.md` states the measured nested call and says that hooks for it are not measured yet (HOOKNEST-01), instead of waiting for a hooks measurement. Phase 5 is not merged and may conflict in that file.
5. Not done: the live canary re-run on 7.0.0 (MCPCANARY-01), the AMIG-01 wording for a skipped server (MCPMIG-01, user-visible, needs a scenario), and the MCP file link rule (MCPLINK-01, waits for the user). No gap report was filed.
6. `withStubServers`: the stub-marker limit is documented in the fixture writer, the step, and `layout.md`, not fixed by narrowing the marker match.
7. `ci.yml`: the note records a local components-shard run on the combined tree (215 scenarios, 2 min 26 s, seed 520794). The hosted re-measure is still to do.
8. The optional README "or an MCP bundle" was applied in both READMEs.

### DC-33: Phase 4 (Agents), merged at ef558e9

Full entries: `.planning/phases/04-agents/04-DUBIOUS-CHOICES.md`, P4-DC-01..12. The child session ran discuss, plan (6 plans, 4 waves), execute, validation (compliant), security (19 threats, 0 open), one review round (one warning, fixed) and verification (passed 5/5). Phase transitioned on its branch.

**For the user to review first (all High, settled without the user):**
1. **D-CF4-04, skill preload:** a preloaded skill's content goes into the agent's system prompt, because pi-subagents passes only a path. Upstream puts it in the child's first user message. Each preloaded skill grows the generated agent file.
2. **D-CF4-05, foreground default:** every non-MCP bridged agent now emits `async: false`, as upstream runs agents in the foreground; `background: true` emits `async: true`. Users who relied on pi-subagents' async default see a change.
3. **D-CF4-14, `advertise: true`:** every bridged agent now appears in the parent system prompt, which changes every parent prompt when pi-subagents is loaded.
4. **D-CF4-09, untrusted projects:** pi-subagents refuses project-scope agents in an untrusted folder; Claude Code runs them. Kept as a Pi-gap divergence and pinned.
5. **D-CF4-10, AGT-04:** no scenario runs a background agent: the detached child cannot load the scripted model, and parent and child calls race on one script. Recorded as a gap.

**Also:**
6. **P4-DC-02 (process):** the Claude Code 2.1.316 probes ran under `env -i` with a fresh HOME, but the binary still reads `/home/claude/.claude/remote/.oauth_token` and `.session_ingress_token`. All 52 captured requests went to the local stub, no auth header was saved, no credential was written. Future probes should run where that directory is absent or unreadable.
7. Nested agents flatten with `-` and can collide with a flat name (first wins, warns); dotfiles and case-insensitive `.md` load as upstream; `--map-model` targets the 5.x IDs; the fallback description is upstream's text.
8. The branch carries `72f9a02 docs(04): record code review disposition` with a phase number and no trailers (a GSD helper commit, already pushed); the final squash merge drops it.
- Parent lines pending: CHANGELOG, READMEs, PROJECT D-CF4-01..14, BACKLOG, PRD and `docs/env-vars.md`, cucumber skill notes, the unfiled pi-subagents defect report and Pi gap notes, and Phase 6's stale "cannot narrow" MCP warning.
- Merge: REQUIREMENTS and STATE conflicts in the tracking tables only.

#### Phase 4 parent lines (applied by the parent at 249c2ec..4b29a69; `npm run check` exit 0, 1376/1376, seed 278404)
1. D-CF4-01..14 rows shortened, outcome kept `-- Locked`. The `P4-DC-NN` references are kept, not renumbered, as the D-CF7 rows keep `P7-DC-NN`. AGT-01..07 and XK-01 moved to Validated.
2. CHANGELOG: the two sub-bullets that broke the one-sentence rule were joined, and so was the skill preload one. "Run `/claude:plugin reinstall`" names `<plugin>@<marketplace>`, as the skills bullet does.
3. `layout.md`: the Agents row's step module is now `listing.steps.ts`, but its seed features column keeps Phase 1's two seeds (as the other rows do). The six agent features are named in a note below the table instead.
4. Not applied, recorded in BACKLOG: the stale ANAME-02 "cannot narrow" warning (AGTEXCL-01; user-visible, no drafted text, needs a scenario), the `info` agent listing (AGTINFO-01), the frozen-harness `{pi-subagents dir}` token and scripted-model import (AGTTOKEN-01, AGTASYNC-01), and the unfiled pi-subagents report (AGTSUB-01, an ID the parent added).
5. `shared/fs-utils.ts`: the comment names the commands bridge and the skills bridge's command-name check, not the commands bridge only, because `bridges/skills/skill-names.ts` also calls `isPlainMarkdownFile`.
6. The sibling re-verification that D-CF4-14 asks for (every whole parent-prompt comparison) rests on the full `npm run check` above.

### DC-34: Phase 3 (Slash Commands), merged at 5e81db0

Full entries: `.planning/phases/03-slash-commands/DUBIOUS-CHOICES.md`, P3-DC-01..23. This is the replacement session (the first one stalled in setup; it later woke, stood down, and pushed nothing). It ran discuss, plan (9 plans, 5 waves), execute, security (30/30 closed), validation (compliant), two review rounds (two warnings fixed) and verification (passed 5/5). Before its phase gate it merged the milestone branch (Phases 4, 6, 7) into its own and removed one new clone group without a suppression marker.

**For the user to review first:**
1. **P3-DC-02 (High, process): the upstream probe reached `api.anthropic.com`.** Under `env -i` with a throwaway HOME, the Claude Code 2.1.316 binary still fetched `https://api.anthropic.com/api/claude_code/policy_limits` in the first 16 probe trees and received a signed policy tied to an identity the probe cannot name. The core probes were re-run in a loopback-only namespace (`unshare -rn`) with identical results; a few edge variants rest on the networked runs. Together with DC-33 item 6 (Phase 4's probe read host token files), future probes should start inside `unshare -rn` where `/home/claude/.claude/remote` is absent; the research skill's recipe should say so.
2. **P3-DC-03 (High), D-CF3-01:** commands stay invisible to the model, because Pi cannot show the model a prompt template. Upstream lists a described command in the model's skill list. Recorded as a Pi gap; staging each command also as a skill was rejected.
3. **P3-DC-04, D-CF3-02:** `user-invocable: false` commands stay listed and runnable (extends D-CF1-09); upstream hides them from the user.
4. **P3-DC-06:** a marketplace entry's `commands` now adds to `commands/` instead of replacing it, as the binary does. This corrects the earlier D-CF1-06.
5. **D-CF2-13 extended to commands:** a project-scope command runs only when this user installed it into this project, checked by file digest in the user-scope ledger. Project commands installed before this change abort until updated or reinstalled (CHANGELOG line).
6. Behavior changes for parity: the description fallback is upstream's (first body line, 100 characters); the `plugin.json` object-map `commands` form and a single declared `.md` file now install; typed commands fill arguments and run `!` lines as upstream.
- Deferred: command frontmatter `name` aliases (P3-DC-07); Claude Code's command tag block is not sent (P3-DC-08).
- Parent lines pending: CHANGELOG, seven BACKLOG items, PRD and docs, PROJECT D-CF3-01..13, the Pi gap report additions (unfiled), two Phase 2 follow-ups (ledger naming, the clash check missing declared command files), a re-probe note for marketplace-entry declarations, and the research-skill probe fix.
- Merge: clean; the parent restored STATE.md's position block.

### DC-35: Phase 5 (Hooks), merged at 6891832

Full entries: `.planning/phases/05-hooks/DUBIOUS-CHOICES.md`, P5-DC-01..25. The child session ran discuss, plan (9 plans, 5 waves), execute, validation (compliant; its one gap exposed and fixed a real divergence: PostToolUseFailure sent `tool_response` instead of upstream's `error`), security (31/31 closed, but written before the review fixes), three review rounds (9 findings fixed, including two critical fail-open bugs on output overflow) and verification (passed 5/5, HOOK-01..09).

**For the user to review first:**
1. **P5-DC-11 (High, security): project-scope hooks ran with no D-CF2-13 provenance check.** The ledger module was not on the Phase 5 branch, so a repository-controlled project could run hook commands. The parent adds the check after this merge (see the follow-up entry below) and re-runs the Phase 5 security audit.
2. **P5-DC-03 (High), D-CF5-02/03:** Pi `fork` sends SessionEnd `resume` (read from upstream `/branch` in the binary, not probed); Pi `quit` sends `prompt_input_exit` in the TUI and `other` elsewhere; Pi `/reload` runs neither SessionStart nor SessionEnd, as upstream `/reload-plugins`. Cleanup hooks no longer run on reload. The `logout` matcher is admitted but never fires, as upstream.
3. **P5-DC-04 (High):** three parity gaps licensed only by phase ownership, each a BACKLOG line: a manifest or marketplace-entry `hooks` field is reported `{unsupported hooks}` instead of merged (D-CF5-20); existing partial installs are told to `reinstall` instead of being healed by `apply` (D-CF5-08); Pi `--resume`/`--fork` launches still send `startup` (D-CF5-06).
4. **P5-DC-24:** review stopped at its three-round cap with two edge-case warnings in follow-up prompt context (a follow-up whose hook is still running when the run ends, or one read after a terminating tool batch, loses its hook context with only a debug line). Both are BACKLOG lines with the reviewer's fix.
5. Behavior changes for parity: `new` sends SessionStart/SessionEnd `clear`; each compaction runs SessionStart `compact`; matching hooks run in parallel and duplicates once; prompt-hook context goes beside the prompt instead of replacing it; a new `hook-notice` notification kind shows `systemMessage` and block notices; a hook on a plugin MCP tool fires once under its real name, also through the adapter's proxy (D-CF5-12).
- Merge: conflicts in the three tracking files and `docs/hooks-compatibility.md`. The parent took Phase 5's doc whole, because its measured D-CF5-12 text replaces Phase 6's interim "not measured yet" note.
- Parent lines pending: CHANGELOG, the PROJECT.md line-1344 correction and D-CF5-01..28, about 25 BACKLOG items, the cucumber token-docs line, `platform/pi-api.ts` (widen `tool_result` content, re-export `TurnEndEvent`), the CONVENTIONS fallow-marker count, research-file corrections, and `/gsd-secure-phase 5` after the provenance fix.

### DC-36: Project hooks gain the provenance check (29a755e..eec6424)

The parent closed P5-DC-11 after the merge: project-scope hooks run only when this user installed their plugin into the project (D-CF2-13 extended to hooks). `npm run check` exit 0, 1529/1529 (seed 229416). Red proof: with `event-router.ts` reverted, the unrecorded and changed-file scenarios in `features/hook/project-provenance.feature` fail.

1. **One shared ledger file.** Hooks entries sit in the existing per-project `skills.json` map under `hooks/<plugin>` (commands already share it), not in a sibling `hooks.json` as the Phase 5 note expected. A separate file would have needed a second writer with the WR-02 rules, and the skills writer deletes the whole per-project directory when its last skill goes. The names stay skill-flavoured (`ProjectSkillLedger`, "project skill ledger" warning text).
2. **The ledger moved to `persistence/project-installs.ts`**, because the fallow zones forbid hooks and the entry from importing bridges-skills. The skill digest helpers moved with it.
3. **Silent skip.** An unrecorded project hook is skipped with only a debug line, as upstream's `not_installed_here`. Hydration runs before reconcile and outside any command, so no existing notification fits. Users with existing project hook installs see their hooks stop; only the CHANGELOG and docs say to reinstall.
4. **Digest covers only the staged `hooks.json` bytes.** It does not bind `resolvedSource` (the `CLAUDE_PLUGIN_ROOT` that `state.json` records) or the scripts under the plugin root. A repository that edits its in-repo clone, or points `resolvedSource` elsewhere, can still change what an installed hook command runs. Same accepted residual as WR-03 for skills (AR-02-05); needs its own threat-register ID.
5. The second cache writer now parses the staged `hooks.json` it checked, not the plugin source path. The ledger read goes through the existing reader and `getAgentDir()` rather than a new port member.
6. Gaps: the update swap's "new version drops hooks" removal and the install undo ignore ledger warnings (WR-04 residual pattern); a retry after a failed forget can leave a stale entry; no scenario covers `update` or `enable` keeping a project hook runnable.
7. **Found while fixing it: the background autoupdate pass (D-PL8-01) updates project-scope plugins with no trust check, and the update writes this user's ledger, so a cloned repository can get its plugin "installed by this user" with no command typed.** This defeats D-CF2-13 for skills, commands and hooks. The parent is closing it as D-CF2-15 (see DC-37).

### DC-37: Background autoupdate kept out of the project scope (0b29f66, e8d600a)

**Decision for the user to review: D-CF2-15, taken by the parent without asking.** The background autoupdate pass (D-PL8-01, run after the first input of a TUI session) used to refresh project marketplaces and update project plugins with no trust check. The update writes this user's provenance ledger, so a cloned repository could get its plugin recorded as installed by this user with no command typed, defeating D-CF2-13 for skills, commands and hooks. The pass now covers the user scope only. A project's pending update shows in the load's pending block, as under D-CF2-14. `/claude:plugin update --scope project` and `marketplace update` still change the project scope. `npm run check` exit 0, 1529/1529 (seed 505638). Red proof: with the source stashed, the new scenario shows "Plugins updated: demo and beta" instead of "Plugin updated: beta".

1. **No trust check, just a skip.** A user who explicitly trusted a project and turned on its autoupdate also loses background updates there; Pi 1.4.0 cannot tell explicit trust from automatic trust (same trade-off as D-CF2-14).
2. **No other automatic route writes project installs or the ledger.** The pass was the only one besides load-time autoapply (already closed). Its only trigger is the first TUI input.
3. The scenario "the TUI background notice names a plugin once while both updated installs remain" was removed: it needed one plugin updated in both scopes, which cannot happen now. The notice's de-duplication stays unit-tested only.
4. The new scenario checks a skill only; commands and hooks share the same skipped write.
5. Docs point to `marketplace update` or `update --scope project`, not `apply`, because `apply` does not refresh a git marketplace.

#### Phase 3 and Phase 5 parent lines (applied by the parent at 807f9b8..eb838b6; `npm run check` exit 0, 1529/1529, seed 732992)
1. Decision rows keep their drafted outcomes: D-CF3-07 "Pending (user review, with D-CF2-13)", D-CF3-13 "✓ Good", D-CF5-06/08/16/20/28 "-- Deferred"; the rest `-- Locked`. Rows are shortened; full text stays in 03-09/05-09 SUMMARY. Some rows cite BACKLOG IDs the agent named.
2. `platform/pi-api.ts`: `tool_result` content widened to text and image parts (two casts removed); `TurnEndEvent` not re-exported because fallow flags it unused (PIAPITURN-01).
3. `.fallowrc.json`: `dynamicallyLoaded` and `ignoreExports` removed (Phase 3 line), fallow green.
4. The Pi gap report draft in 02-07-SUMMARY gained the command gaps (sections 4-6). Still unfiled.
5. BACKLOG: 35 items. The two Phase 2 follow-ups are recorded, not fixed (LEDGERNAME-01, SKILLCLASH-01). HOOKNEST-01 closed by D-CF5-12. HOOKDATA-01 records a likely real mismatch: hooks use `data/<pluginId>` while skills and commands use `data/<marketplace>/<plugin>`.
6. `05-SECURITY.md`: T-05-28 marked mitigated by hand (da72ba4, D-CF2-15); new T-05-31 / AR-05-06 for the hooks residual. The audit re-run follows.
7. compat-research skill: probes start inside `unshare -rn`, only where `/home/claude/.claude/remote` is absent or unreadable.
8. CONVENTIONS recount: 41 markers, 23 `code-duplication`. CHANGELOG hook lines are reworded; a few run slightly over 25 words.

### DC-38: Unnamed project re-stages never create ledger entries (fed700e, 408fa23)

**Decision for the user to review: D-CF2-16, taken by the parent without asking.** The post-merge Phase 5 re-audit (`05-SECURITY.md`, 2026-11-02) found T-05-32 (high): a bare `/claude:plugin update` or `reinstall`, the `marketplace update` cascade, and `apply`'s convergence re-staged every project plugin the repository's `state.json` lists and recorded it in this user's ledger, so the repository's hooks, skills and commands ran. Now a re-stage that names no plugin may only refresh entries that already exist (`ProjectLedgerAdmission = "refresh"`); naming the plugin (`install`, `update`, `reinstall`, `enable` X) still creates them, as the abort messages advise. Upstream parity: `/plugin update` touches only `installed_plugins.json` entries. `npm run check` exit 0, 1534/1534 (seed 78049). Red proof: with the eight source files at HEAD, the four new "stays off / stays refused" scenarios fail.

1. **Residual (parent's call):** `apply`'s install, enable and missing-dependency steps for a plugin the project config declares still create entries, because typing `apply` is the explicit consent D-CF2-14 relies on.
2. **Per plugin, not per entry:** a recorded plugin's new version can add new skill, command or hook entries under refresh. The ledger keys plugins by name only, not marketplace.
3. **Absent means create:** existing callers keep their behavior and every production "not aimed" site sets `refresh`, but a future caller that leaves the field out gets `create` (not fail-closed).
4. `@marketplace` targets count as not aimed. Dependencies take the command's admission.
5. No notice when a plugin is updated but left unrecorded; a refused skill or command prints the recovery command, but a refused hook only logs a debug line.
6. The missing-dependency install under a bare update is covered by unit tests only.
- Phase 5 security now has `threats_open: 0`; T-05-33 (a hook's stdout cut at 1 MB under `onFailure: "block"` reads as no decision; HOOKBIGJSON-01) and T-05-34 (project `CLAUDE_PLUGIN_DATA` sits inside the repository; HOOKDATA-01) stay open below the threshold without a disposition.

## Appendix: per-phase logs in full

Copied verbatim from each phase directory on 2026-11-02, with headings shifted. The phase files stay the source; the summary entries DC-31 to DC-35 above point here.

### Phase 3 (Slash Commands): Dubious Choices Log

Phase log for the child session on `features/component-features-phase-3`. Same
shape as the root `.planning/DUBIOUS-CHOICES.md`; the parent merges these
entries into it. Severity and status follow the root file's rules.


#### P3-DC-01: Branch fast-forwarded to the milestone head before discuss

- **Phase / source:** Phase 3 child session, before discuss.
- **Severity:** Low. **Status:** open.
- **Choice:** `features/component-features-phase-3` (at `3a7a707`, an
  ancestor of the milestone) was fast-forwarded to
  `origin/claude/quirky-planck-hhm592` at `0e360ca`, so Phase 3 builds on
  Phase 2's executed and reviewed skills code (D-CF2-13 ledger,
  `orchestrators/skill-invocation.ts`), and its gates run on that combined tree.
- **Alternatives:** Stay on `3a7a707` and design against the expected shape of
  the ledger, as the parent's brief suggested.
- **Why dubious:** The parent expected to reconcile at merge. A fast-forward
  is a merge with no new commit and breaks no git rule; any later Phase 2
  change still merges normally.
- **Recorded in:** `03-CONTEXT.md` header.

#### P3-DC-02: The upstream probe reached api.anthropic.com

- **Phase / source:** Phase 3 research subagent (`03-UPSTREAM-EVIDENCE.md`,
  "Isolation gap").
- **Severity:** High (process). **Status:** open.
- **Choice:** The probe ran `claude plugin` commands under `env -i` with a
  throwaway HOME and config dir. The binary still fetched
  `https://api.anthropic.com/api/claude_code/policy_limits` (its built-in API
  address, not `ANTHROPIC_BASE_URL`) in the first 16 trees and received a
  signed policy tied to an identity the probe cannot name. The subagent
  stopped networked runs and re-ran the core probes (base, object map, mixed
  array) in a loopback-only namespace (`unshare -rn`, `tree/bin/netns.sh`)
  with identical results. A few edge variants (Q3 extras, Q7 string form)
  rest on the networked runs only.
- **Alternatives:** Discard all networked results and re-run every variant in
  the namespace.
- **Why dubious:** It broke the probe's localhost-only rule. Future probes
  should start inside `unshare -rn`. The research skill's recipe should say so
  (parent line).
- **Recorded in:** `03-UPSTREAM-EVIDENCE.md`, `03-CONTEXT.md`.

#### P3-DC-03: Commands stay invisible to the model (FG-11)

- **Phase / source:** Phase 3 discuss (D-CF3-01).
- **Severity:** High. **Status:** open.
- **Choice:** Record a Pi gap. A command with a description is in Claude
  Code's model skill list and runnable through the Skill tool (E1); in Pi it
  stays a user-only prompt template.
- **Alternatives:** Also stage each command as a Pi skill, which gives the
  model the command but adds a `/skill:<plugin>-<name>` entry upstream lacks
  and Pi cannot hide.
- **Why dubious:** Model-invoked commands are common upstream; a plugin that
  relies on the model running its commands loses that in Pi.
- **Recorded in:** `03-CONTEXT.md` D-CF3-01.

#### P3-DC-04: `user-invocable: false` commands stay listed and runnable (FG-12)

- **Phase / source:** Phase 3 discuss (D-CF3-02, extends D-CF1-09).
- **Severity:** Medium. **Status:** open.
- **Choice:** Keep listed and runnable. Upstream hides and refuses the command
  but lets the model run it (E2); with D-CF3-01, hiding it in Pi would make it
  unreachable.
- **Alternatives:** Refuse the typed command in the invocation handler, as
  upstream does.
- **Why dubious:** The user sees a command the author hid.
- **Recorded in:** `03-CONTEXT.md` D-CF3-02.

#### P3-DC-05: Object-map keys go through the Pi command naming (FG-13)

- **Phase / source:** Phase 3 discuss (D-CF3-03).
- **Severity:** Medium. **Status:** open.
- **Choice:** Support the object map. Keys go through `generatedCommandName`:
  CM-2 elision applies, a `/` becomes a `:` segment, and keys that upstream
  refuses (trailing `:`, `<`, `>`) or that Pi cannot type (whitespace) are
  skipped with a warning. Missing or non-`.md` sources, and a second key on
  one file, skip the entry with a warning (upstream is silent, or reports
  "failed to load" in `plugin list`).
- **Alternatives:** Keep keys verbatim (impossible for `/` in a Pi file name);
  record the object map as unsupported.
- **Why dubious:** Names differ from upstream for elided and `/` keys; the
  warnings are this project's, not upstream's.
- **Recorded in:** `03-CONTEXT.md` D-CF3-03.

#### P3-DC-06: A marketplace entry's `commands` adds to `commands/` (corrects D-CF1-06)

- **Phase / source:** Phase 3 discuss (D-CF3-04).
- **Severity:** High. **Status:** open.
- **Choice:** Follow the binary: `commands/` is read unless `plugin.json`
  declares `commands`; an entry declaration adds to it, and an entry's inline
  `content` commands are dropped with a warning. This supersedes the
  marketplace-entry half of D-CF1-06 for commands only.
- **Alternatives:** Keep D-CF1-06 (the docs say a plugin with no
  `plugin.json` treats the entry as the manifest).
- **Why dubious:** It changes a Phase 1 decision the parent made, the docs
  disagree with the binary, and agents and workflows may have the same
  difference (parent line to Phases 4 and 7).
- **Recorded in:** `03-CONTEXT.md` D-CF3-04.

#### P3-DC-07: Command frontmatter `name` aliases deferred

- **Phase / source:** Phase 3 discuss (deferred ideas, E9).
- **Severity:** Medium. **Status:** open.
- **Choice:** Upstream gives a command with frontmatter `name` the aliases
  `/<plugin>:<name>` and `/<name>`. Phase 3 does not add them; a backlog line
  goes to the parent.
- **Alternatives:** Resolve them in the command invocation handler, as
  D-CF2-02 does for skills.
- **Why dubious:** An unlicensed parity gap left open to keep the phase
  bounded.
- **Recorded in:** `03-CONTEXT.md` `<deferred>`.

#### P3-DC-08: Claude Code's command tag block not sent

- **Phase / source:** Phase 3 discuss (D-CF3-06).
- **Severity:** Low. **Status:** open.
- **Choice:** The model receives the substituted body only, as Pi's template
  expansion sends it; upstream prefixes `<command-message>`/`<command-name>`/
  `<command-args>` tags (E6). Residual under D-CF1-01.
- **Alternatives:** Prepend upstream's tag block.
- **Why dubious:** The model sees different framing than in Claude Code.
- **Recorded in:** `03-CONTEXT.md` D-CF3-06.

#### P3-DC-09: Phase 3 research choices (accepted by the orchestrator)

- **Phase / source:** Phase 3 researcher (`03-RESEARCH.md`); the orchestrator
  accepted each item for planning and answered the open questions.
- **Severity:** Medium (items 1-4); the rest Low. **Status:** open.
- **Items:**
  1. **Staged command frontmatter rebuilt as one `"key": <JSON>` line per
     key** (Pi's YAML refuses duplicate keys, so appending `description:`
     breaks a file with `description: ""`; the rebuild avoids copying Phase 2's
     line scanner). Every staged command's bytes change.
  2. **Ledger writer passed in:** `commitPreparedCommands` and
     `UnstageCommandsInput` take a required `ledger`; the four orchestrator call
     sites (`install-outcome.ts` twice, `update-swap.ts`,
     `marketplace/shared.ts`) pass Phase 2's `NODE_PROJECT_SKILL_LEDGER`, whose
     name says "skill" (rename is a parent line). Project commands installed
     before this phase abort until updated or reinstalled (CHANGELOG line).
  3. **E8 residual:** a returned body that starts with `/<template>` is
     expanded again by Pi; resending through `sendUserMessage` would turn the
     RPC response into `handled` and change error routing. Pinned by a unit
     test.
  4. **Four waves, not three:** the staged-file writer is touched by the
     frontmatter (wave 2) and manifest-forms (wave 3) plans.
  5. Object-map entries ride on `componentPaths.commandMap` (optional field);
     `componentPaths.commands` stays `string[]` for Phase 2's shadow check.
  6. Abort origin `{kind: "command", commandId: <typed name without "/">}`
     (open string, no closed-set edit; a `docs/json-output.md` parent line).
  7. First-wins order: `commands/`, then `plugin.json` paths, then
     marketplace-entry paths (inferred from upstream's listing order).
  8. The lenient `info` mirror always includes `commands/` because it cannot
     see `plugin.json`.
  9. A map `source` that escapes the plugin root or is a symlink makes the
     plugin unavailable, like any escaping component path.
  10. Phase 3 features reuse two Phase 2 step texts (system-prompt skill list,
      "the user's pi directory records no plugin install for the project").
  11. An untrusted project keeps its own abort text, as skills do.
- **Open questions answered by the orchestrator (recommended options):**
  map keys with hidden or direction-changing characters (`\p{Cf}`) are
  skipped with a warning, as upstream refuses them; a plugin whose only
  commands come from a map counts `commands` as supported; the collision
  order is item 7; the TUI source tag is spiked before the expected value is
  written.
- **Recorded in:** `03-RESEARCH.md`, `03-VALIDATION.md`.

#### P3-DC-10: Phase 3 planning choices

- **Phase / source:** Phase 3 planner (`03-01..09-PLAN.md`).
- **Severity:** Medium (items 1-4); the rest Low. **Status:** open.
- **Items:**
  1. **Five waves, nine plans** (the ledger writer and the object map split
     out): wave 1 tracer 03-01; wave 2 frontmatter 03-02, invocation 03-03,
     declared paths and entry rule 03-04, lifecycle 03-05; wave 3 ledger writer
     03-06; wave 4 ledger check 03-07 and object map 03-08; wave 5 gate 03-09.
  2. **Project commands run without the ledger check between waves 2 and 4**;
     only the phase gate covers the finished rule.
  3. **D-CF3-07's abort text follows D-CF2-13's current wording** (it names
     reinstall), not the CONTEXT literal.
  4. **The "uninstall before `/reload`" abort scenario lives in invocation
     (03-03)**, not lifecycle.
  5. Command ledger warnings ride Phase 2's `skillWarnings` member (wording
     names the commands; rename is a parent line).
  6. Ledger scenarios use a commands-only plugin `solo`, because
     `offers these plugins:` always adds a skill.
  7. The description fallback reads the body after install-time substitution
     and reference rewrite (differs from upstream only for a first line naming
     `${CLAUDE_PLUGIN_ROOT}`).
  8. The writer's read-back compares the JSON form of the frontmatter, so a
     non-finite YAML number stages as `null`.
  9. The reinstall-owner lookup reads `state.json` with
     `persistMigration: false` (skills side saves one; Phase 2 parent line).
  10. The argument-hint check uses `this.startTuiSession()` in the shared
      sandbox after a spike; the source tag is unconfirmed.
  11. Extra scenario: `info` of an unavailable plugin with entry-declared
      `commands`.
  12. Entry maps with both or neither of `source`/`content` make the plugin
      unavailable (unprobed for entries).
  13. `\p{Cf}` map keys are skipped (beyond D-CF3-03's list, per upstream).
  14. A declared path or map `source` through a symlink makes the plugin
      unavailable (today's containment rule).
  15. The ledger digest covers only the staged command file, not plugin
      scripts a `!` command runs (residual).
  16. The "user's own template" Given writes `<agent dir>/prompts/<name>.md`.
  17. `test/index.test.ts` gets more than an expected-value edit (`pi` exposed
      on `LoadedExtension`; the listener type may return a Promise), limited
      by a `git diff` criterion.
  18. Inline map commands record a synthetic `sourcePath`
      `<plugin root>#commands.<key>` (MCP bridge precedent).
  19. An abort's `commandId` is the command name without its slash.
  20. `/claude:plugin info` still does not list declared command files or map
      entries (residual parent line).
  21. 03-01 carries an extra `promote` assumption-delta block.
  22. 03-01's degraded-command scenario assumes that install reports only
      warnings (`, which warned`).
- **Recorded in:** the plans.

#### P3-DC-11: Orchestration choices for Phase 3 execution

- **Phase / source:** Phase 3 orchestrator (execute-phase).
- **Severity:** Low. **Status:** open.
- **Items:**
  1. Executor prompts tell each executor to Read the GSD execution files by
     absolute path instead of inlining them (DC-17 precedent), and add the
     project rules and environment facts blocks.
  2. The post-merge gate is the project's `npm run check` (AGENTS.md), not the
     workflow's build-command sniff. When a wave's merge result has the same
     build inputs as a tree the executor already passed `npm run check` on
     (the wave base had not moved, only the SUMMARY was added), the passing
     result is reused, as AGENTS.md allows. Wave 1: the executor's run at
     `b6a3912`; the merged tree adds only `03-01-SUMMARY.md`.

#### P3-DC-12: Plan 03-01 executor choices (staged command writer)

- **Phase / source:** 03-01 executor (`03-01-SUMMARY.md`).
- **Severity:** Low-Medium. **Status:** open.
- **Items:**
  1. The read-back check can fail an install: a frontmatter key over 1024
     characters (legal as an explicit `? key`) becomes an implicit key in the
     JSON-flow rebuild, which Pi's parser refuses (`BridgeStagingError`, no
     degrade).
  2. The description fallback is computed on the body after CM-3
     substitution and the reference rewrite (upstream: raw body).
  3. A frontmatter that parses to a list or a scalar is dropped without a
     warning.
  4. Outline rows with no declared description write `description:` (YAML
     null); scenarios cover null, `""`, and no frontmatter.
  5. The 101-character fallback row pins a 97-character cut that ends on a
     space, as `A2e` does.
  6. Mocked neutralize-safeguard unit cases kept (the function moved
     unchanged, with branches real input cannot reach).
  7. One live marker each side keeps `dup:23c99c81` hidden; three stale
     commands-side markers deleted. Rebuild also strips a second BOM, as
     Pi's parser does. `P3-DC-09` is not cited in code comments (phase IDs
     are forbidden there).

#### P3-DC-13: Plan 03-02 executor choices (frontmatter)

- **Phase / source:** 03-02 executor (`03-02-SUMMARY.md`).
- **Severity:** Low. **Status:** open.
- **Items:**
  1. Pi's menu em dash is matched as `--`, because the `fix-unicode-dashes`
     pre-commit hook rewrites `—` in the feature file; a description holding
     `--` cannot be told apart from the join.
  2. The terminal-menu table lists Phase 2's `demo:demo-skill` alias row, so a
     skills alias change changes this scenario.
  3. The menu parser slices fixed 120-column rows (PTY width, Pi pads rows).
  4. Pi's `[t]` source tag is pinned as rendered.
  5. Existing unit cases that set `model: sonnet` now also expect the
     dropped-fields line (inputs unchanged).
  6. The executor's commits carry this child session's own `Claude-Session`
     trailer (`session_01EDUMG8nFuockQFTkJixpie`, from its harness reminder)
     instead of the parent's line the brief asked for; history is not
     rewritten.

#### P3-DC-14: Plan 03-03 executor choices (invocation)

- **Phase / source:** 03-03 executor (`03-03-SUMMARY.md`).
- **Severity:** Low-Medium. **Status:** open.
- **Items:**
  1. A `"kind" in loaded` check narrows the read result instead of an
     explicit discriminated union.
  2. Bash-missing is checked even for a body with no `!` command (as skills
     do; upstream may check only when a pattern exists, not verified).
  3. The Outline's `placeholder` column only labels rows.
  4. A staged-file parse failure has no unit case of its own (same `.catch`
     as a read failure).
  5. The hooks feature's data-directory literal (`data/demo`) differs from the
     commands and skills one (`data/<marketplace>/<plugin>`): a parent line
     for the Hooks phase.
  6. The handler's slash-line regex became `startsWith` plus one `\s` search
     (lint `sonarjs/super-linear-regex`); the invoker type is inline (fallow
     private-type leak).

#### P3-DC-15: Plan 03-04 executor choices (declared paths and entry rule)

- **Phase / source:** 03-04 executor (`03-04-SUMMARY.md`).
- **Severity:** Low-Medium. **Status:** open.
- **Items:**
  1. A declared non-`.md` file warns where upstream is silent (D-CF3-05).
  2. CM-2 elision applies to declared files (`demo-a.md` gives `demo:a`),
     under the recorded D-141-01 divergence; upstream names it `demo:demo-a`.
  3. The FG-14 pin runs the install as a `When` (the install Given rejects
     warnings and this install always notes the shadowed folder).
  4. An entry `"commands": []` still reads the folder (inferred from E4, not
     probed).
  5. A Unix socket stands in for "not a regular file" in a unit case.
  6. Residuals for the parent: `/claude:plugin info` does not list a declared
     single-file command (`discoverComponentNames` reads directories only);
     Phase 2's `commandUpstreamNames` reads each commands path as a directory,
     so a declared command file adds no name to the D-CF2-03 clash check.

#### P3-DC-16: Plan 03-05 executor choices (lifecycle)

- **Phase / source:** 03-05 executor (`03-05-SUMMARY.md`).
- **Severity:** Low. **Status:** open.
- **Items:**
  1. The update scenarios replace the whole command file (description and
     body change together; listing pins one, the model log the other).
  2. A negative edit keyed on `allowExistingRecord` (temporary).
  3. `Given pi runs with the scripted model` sits in the Background, because
     the listing step needs the profile Pi.

#### P3-DC-17: Plan 03-06 executor choices (project-command ledger writer)

- **Phase / source:** 03-06 executor (`03-06-SUMMARY.md`); wave 3 gate reuse.
- **Severity:** Low-Medium. **Status:** open.
- **Items:**
  1. Commands share Phase 2's per-project `skills.json` ledger; on Windows a
     command name uses `.` as the separator, which still never equals a skill
     name (skill names are `a-z0-9-` only).
  2. The digest is over the file's UTF-8 text (03-07 must read it the same
     way).
  3. When the install undo runs after a failed ledger write, the second
     forget warning is dropped.
  4. Command ledger warnings ride the `skillWarnings` member and read
     `could not remove the commands from the project skill ledger: ...`; the
     "skill" wording across the ledger is a rename parent line.
  5. A `prune` rollback does not restore ledger entries (parent line).
  6. Wave 3's post-merge gate reuses the executor's `npm run check` at
     `ce2330b` (seed 713944, 1299 scenarios); the merged tree adds only the
     SUMMARY.

#### P3-DC-18: Plan 03-07 executor choices (provenance check)

- **Phase / source:** 03-07 executor (`03-07-SUMMARY.md`).
- **Severity:** Low-Medium. **Status:** open.
- **Items:**
  1. The digest covers only the staged command file; a plugin script a `!`
     command runs is not covered (the skills digest covers the whole staged
     directory). Accepted as T-03-23; parent gap line.
  2. The refusal names `/claude:plugin reinstall <plugin>@<marketplace>
     --scope project` from the project record that lists the command (state
     read with `persistMigration: false`), or a generic reinstall line.
  3. An unparseable staged file refuses with `Cannot read the command ...`
     before the ledger is read.
  4. The unit fake hard-codes Phase 2's ledger layout and key.
  5. A negative edit counted calls on `globalThis` (temporary).

#### P3-DC-19: Plan 03-08 executor choices (object-map commands)

- **Phase / source:** 03-08 executor (`03-08-SUMMARY.md`).
- **Severity:** Medium (items 1-2); the rest Low. **Status:** open.
- **Items:**
  1. **`allowedTools` accepts a string** (the plan's wording); upstream's
     schema accepts only an array of strings, so `"allowedTools": "Read"`
     installs here and fails upstream.
  2. **A missing map source is an install warning**; upstream shows "failed
     to load" in `plugin list` and says nothing at install.
  3. `\p{Cf}` (and `\p{Cc}`) keys are skipped; hidden characters print as
     `\u{XXXX}` in map warnings only.
  4. Map warnings drop the plugin root (path redaction cut them short); the
     walk's own duplicate warning is still cut short (pre-existing; parent
     line for `shared/redact-absolute-paths.ts`).
  5. A map source inside `commands/` suppresses the shadow note (D-CF1-06's
     reach rule extended; not probed).
  6. A directory source under a bad key is still walked (upstream ignores the
     key for a directory).
  7. Malformed entries (both/neither, wrong types, absolute, escaping, linked
     source) make the plugin unavailable with reason `unsupported source`.
  8. Non-owned test edit: `test/architecture/declared-component-path-overlap.test.ts`
     gains `kind: "file"` in an expected value (`DiscoveredCommand` is now a
     union).
  9. On Windows a key with an inner `:` yields a file name NTFS refuses
     (parent line); `info` still does not list map entries (parent line).

#### P3-DC-20: Milestone merged before the phase gate; a clone fixed on the commands side

- **Phase / source:** Phase 3 orchestrator, before wave 5.
- **Severity:** Low. **Status:** open.
- **Choice:** Before the phase gate, the milestone branch (Phases 4, 6, and 7
  merged, Phase 2 review fixes) was merged into this branch (`bf0b58f`), so
  the phase gate runs on the combined tree. Only `.planning/ROADMAP.md` and
  `.planning/STATE.md` conflicted: the Progress table keeps Phase 3 at 8/9
  and Phase 4 complete; STATE takes the milestone's text. The combined tree
  showed one new clone group (`dup:5cc56bd6`, `bridges/commands/unstage.ts`
  against Phase 2's `bridges/skills/unstage.ts`), born of the milestone's
  marker cleanup and the newer skills return shape. The commands side was
  restructured (`unlinkIfPresent` helper, `d164a80`) instead of adding a
  marker. `npm run check` then passed on the combined tree (seed 412895, 1451
  scenarios).
- **Alternatives:** Leave the integration to the parent's merge; add a
  reviewed `code-duplication` marker.
- **Why dubious:** The parent planned to merge; doing it here front-loads
  conflict resolution in tool-written files.

#### P3-DC-21: Security audit choices

- **Phase / source:** Phase 3 security auditor and orchestrator (`03-SECURITY.md`).
- **Severity:** Low. **Status:** open.
- **Items:**
  1. The 13 accept rows were closed on their plan-time acceptance; the
     orchestrator wrote the accepted-risks log (AR-03-01..10) afterwards.
  2. T-03-28 (gap report not posted) and T-03-03 (Pi sends no frontmatter)
     rest on the SUMMARY text and on a Pi fact the repo cannot check.
  3. `!` command output size stays uncapped (D-CF1-02 residual); not a new
     decision.
  4. Pre-existing, outside the register: `orchestrators/plugin/info.ts`
     lists entry names of declared directories of an unavailable plugin
     without containment (all kinds, names only). Parent line candidate.
  5. The orchestrator skipped the workflow's own preliminary classification
     and sent the whole register to the auditor.

#### P3-DC-22: Code review and fix choices

- **Phase / source:** Phase 3 code reviewer (two iterations), code fixer
  (`03-REVIEW.md`, `03-REVIEW-FIX.md`).
- **Severity:** Low-Medium. **Status:** open.
- **Items:**
  1. WR-01 fix: a failed ledger write now removes the renamed command files
     (direct `unlink`, not the removal port) and rethrows. Old command files
     unlinked before the renames are not restored, so a failed update can
     leave old names recorded with no files (pre-existing for rename
     failures; a retry recovers). The new scenario pins "no commands listed"
     after a failed update.
  2. WR-02 fix: a file claims its path only when its command is admitted; a
     file reached through overlapping commands paths whose first-depth name
     lost now loads under its second-depth name (not probed upstream).
  3. Info items left open: IN-01 (`argument-hint: [x]` parses as a YAML list
     and is dropped silently, upstream not probed), IN-02 (reinstall hint
     names come from the project's `state.json`, as skills do), IN-03
     (map-directory duplicate warnings name the plugin root), IN-04 (menu
     step slices fixed 120-column rows), IN-05 (staged-path match is byte
     exact; a mismatch falls back to Pi's own expansion, no `!` runs), IN-06
     (one unit case asserts the Linux `EISDIR` text; macOS would say EPERM).
  4. The fixer's two commits carry its harness's `Claude-Session` trailer
     (`session_01EDUMG8nFuockQFTkJixpie`) rather than the parent's.
  5. The `--auto` re-review was limited to the two files the fixes touched.

#### P3-DC-23: Phase completion and transition choices

- **Phase / source:** Phase 3 orchestrator (execute-phase `update_roadmap`,
  transition in post-completion mode).
- **Severity:** Low. **Status:** open.
- **Items:**
  1. The regression gate was satisfied by the full `npm run check` on the
     final product tree `a041d22` (seed 843376, 1453 scenarios), which runs
     every prior phase's tests; no separate prior-phase test list was built.
  2. `phase.complete 3` reported nine "references files not on disk"
     warnings; all are false positives (SUMMARY paths relative to the
     extension root, and shell commands). It also advanced STATE.md's
     position to Phase 2, as the tool does; the parent owns STATE.md at merge.
  3. The transition's `evolve_project` step (PROJECT.md Validated line, Key
     Decisions rows, footer) was not run here: PROJECT.md is parent-owned, so
     those edits are parent lines in `03-09-SUMMARY.md`. STATE.md got one
     Recent Decisions bullet; graduation scan found no LEARNINGS files.
  4. Verification passed (5/5); the verifier relied on the orchestrator's
     full-gate measurement and ran focused suites itself (cucumber seed
     800431).

Source: `.planning/phases/03-slash-commands/DUBIOUS-CHOICES.md`.

### Phase 4 (Agents): Dubious Choices Log

Phase log for the child session running Phase 4 of `component-features`, in the
shape of the root `.planning/DUBIOUS-CHOICES.md`. The parent merges these
entries into the root file. Severity and status follow the root file's rules.


#### P4-DC-01: Commit attribution names this child session

- **Phase / source:** Phase 4 child session, setup.
- **Severity:** Low. **Status:** open.
- **Choice:** Commit trailers use this session's own `Claude-Session` URL
  (`session_01EDUMG75mZrbnf4k1GJQjc9`), as the session's attribution notice
  says, not the parent's URL that `CHILD-SESSION-BRIEF.md` prints.
- **Alternatives:** Copy the brief's trailer exactly.
- **Why dubious:** The brief says "exactly"; the parent may grep for its own
  URL.

#### P4-DC-02: Upstream probes read host token files

- **Phase / source:** upstream research subagent (discuss step).
- **Severity:** Medium (process/security). **Status:** open.
- **Choice:** The Claude Code 2.1.316 probes ran under `env -i` with a fresh
  HOME and config dir, but the binary reads the hard-coded
  `/home/claude/.claude/remote/.oauth_token` and `.session_ingress_token`
  regardless. All 52 captured requests went to the local stub; no auth
  header was saved; no credential files were written. Found after the last
  probe; no probe ran afterwards. The subagent also added
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` and `TMPDIR`, and edited only
  the probe's own `.claude.json` to reach the trust dialog.
- **Why dubious:** The compat-research skill requires full isolation; it was
  not achievable. Future probes should run where `/home/claude/.claude/remote`
  does not exist or is unreadable.

#### P4-DC-03: Discuss decisions settled without the user

- **Phase / source:** Phase 4 smart discuss (`04-CONTEXT.md`, D-CF4-01..14).
- **Severity:** High for items 1-4, Medium for 5-7, Low for the rest.
  **Status:** open.
- **Items:**
  1. **D-CF4-04 (skill preload, XK-01):** the bridge inlines preloaded skill
     content into the agent's system prompt, because pi-subagents passes only
     a path. Upstream puts it in the child's first user message. A skill
     update now needs the agent re-staged (same install, so it happens), and
     the generated agent file grows by each preloaded skill.
  2. **D-CF4-05 (`async`):** every non-MCP bridged agent now emits
     `async: false` (foreground default, as upstream), changing behavior for
     users who relied on pi-subagents' async default; `background: true`
     emits `async: true`. MCP-granted agents are left alone for Phase 6.
  3. **D-CF4-14 (`advertise: true`):** bridged agents enter the parent system
     prompt, which changes every parent prompt with pi-subagents loaded and
     may break sibling phases' whole-prompt comparisons at merge.
  4. **D-CF4-09 (trust):** the untrusted-project refusal is kept as a Pi-gap
     divergence (upstream runs plugin agents untrusted); the alternative of
     writing project agents into user scope was rejected.
  5. **D-CF4-01 (nested):** dotfiles and case-insensitive `.md` now load, as
     upstream; flattening nested segments with `-` can collide with a flat
     name (first wins, warns).
  6. **D-CF4-07 (`--map-model`):** targets refreshed to the 5.x model IDs
     upstream's first-party table names (account-dependent upstream).
  7. **D-CF4-03:** the fallback description text changes to upstream's.
  8. **D-CF4-10:** AGT-04 may close on a recorded gap instead of a scenario.
  9. **D-CF4-08:** the stale ANAME-02 "cannot narrow" warning is left for
     Phase 6 / the parent instead of fixed here.
- **Upstream evidence:** `04-UPSTREAM-AGENTS.md`; pi-subagents facts in
  `04-PI-SUBAGENTS.md`.

#### P4-DC-04: Planning-workflow deviations

- **Phase / source:** Phase 4 plan-phase orchestration (child session).
- **Severity:** Low. **Status:** open.
- **Items:**
  1. The `ai-integration` plan:pre step hook was not dispatched although the
     phase goal contains "agent": the phase translates plugin agents for
     pi-subagents and builds no AI system (same reasoning as DC-11).
  2. Plans are made with `REVERSIBILITY_GATES: false`, as DC-12 does for the
     whole run.
  3. Background planner/checker spawns are awaited through the harness's
     completion notifications instead of `gsd_stall_watch` polling (the
     notification is reliable here, and polling would read subagent
     transcripts).
  4. VALIDATION.md is seeded from the template (frontmatter only); the
     validation map lives in `04-RESEARCH.md` "Validation Architecture".

#### P4-DC-05: Research open questions answered by the orchestrator

- **Phase / source:** Phase 4 researcher (`04-RESEARCH.md`); answered in
  `04-CONTEXT.md` "Amendments after research".
- **Severity:** Medium (items 1, 4, 6); the rest Low. **Status:** open.
- **Items:**
  1. AGT-04 closes on a recorded gap (D-CF4-10): the detached runner cannot
     load the scripted model (`JITI_ALIAS` maps `@earendil-works/pi-ai` to
     `./compat`, no `providers/faux`), measured; the parent/child call race
     also remains. A fix needs a frozen file or pi-subagents.
  2. `opusplan` maps to sonnet (upstream record) instead of opus (D-CF4-07 as
     first written).
  3. Declared folder paths recurse (upstream refuses folders); a declared
     symlinked file is refused (upstream follows it).
  4. The untrusted default-scope run is not pinned (its error text names
     repository paths no frozen token covers); only the explicit-scope pair.
  5. `Tool(spec)` maps by tool name; `effort` is lowercased.
  6. D-CF4-04 edits two orchestrator call sites outside Phase 4 ownership
     (`install-outcome.ts`, `update-swap.ts`), minimal and inside their own
     functions; the preload reads the plugin source `SKILL.md`, which can
     differ from the staged copy when the skills bridge repairs YAML or when
     Phase 2 adds a transform later.
  7. Agents without `tools` in a plugin that ships MCP servers keep today's
     output (no `async` field), extending the D-CF4-05 exception.
  8. Researcher choices accepted: `$ARGUMENTS` in a preloaded skill stays
     literal (frozen port, upstream would empty it); AGT-05 "load the
     companion, then `/reload`" is stood in by starting a profile Pi with the
     companion after the shared-Pi install; the default fixture skill from
     `path-marketplace.ts` is an acceptable Phase 1 stand-in for XK-01.
  9. Tests outside Phase 4 ownership need expected-value edits (generated
     bytes, 4.x model IDs): `update-swap.test.ts`, `reinstall-flow.test.ts`,
     `install-flow-ledger.test.ts`, `edge/handlers/plugin/install.test.ts`,
     `update.test.ts`.

#### P4-DC-06: Phase 4 planning choices

- **Phase / source:** Phase 4 planner (`04-01..06-PLAN.md`, `COVERAGE.md`).
- **Severity:** Medium (items 1, 2, 5, 9); the rest Low. **Status:** open.
- **Items:**
  1. The D-CF4-04 skip warnings and the D-CF4-05 guided-field warnings go to
     the existing hygiene channel, so a standalone install does not print them;
     scenarios see them through an `apply` that moves the plugin. CONTEXT says
     "install warning".
  2. The builtins control hides only the builtin `researcher` (the em-dash
     fixer rewrites its description), so it shows 12 of 13 builtins; new step
     `pi-subagents hides the builtin agent {string}`.
  3. Settings Givens merge into `{agent dir}/settings.json` after the profile
     Pi starts; a release restores the previous bytes.
  4. The `has these agents:` table reads any column other than `file` and
     `body` as a frontmatter key (loosens the unknown-column rule).
  5. One trailing `[1m]` is stripped from a model alias; the `claude-`
     pass-through is case-sensitive and refuses `:` and whitespace (T-04-06,
     beyond the decision text). `thinking` is matched exactly; only `effort`
     is normalized.
  6. A `Tool(spec)` in `disallowedTools` disallows the whole tool; a `*`
     anywhere in `tools` takes the omitted-tools path.
  7. Preloads are read lazily for named skills only; read errors propagate;
     an unparseable skill is skipped; skipped skills are left out of
     `skills:`; a known skill with no source row keeps its `skills:` entry.
  8. The walk is depth first, so a nested agent wins over a flat file with
     the same flattened name (upstream lists both); a folder at 32 segments
     is skipped silently (upstream debug-logs).
  9. AGT-04 closes on the recorded gap from the researcher's measured runs;
     no new probe is planned.
  10. `install-outcome.ts` gains a `stagedSkillRecords` context field (4 edits)
      to keep 100% coverage; two `update-flow.test.ts` cases outside
      ownership get new expectations and titles.
  11. AGT-06 gains two pins: a trusted default-scope run and a user-scope
      agent run in an untrusted project.
  12. Three tasks exceed the five-file split rule (04-01: 17 files plus a
      deletion; 04-02 Task 1: 9; 04-05 Task 1: 10), forced by the wave split.
  13. Wave 1 deletes the seed `features/step_definitions/agent/runs.steps.ts`;
      wave 3 creates a new one. Expected agent literals in tests change twice
      (`advertise` in wave 1, `async` in wave 2).
  14. The planner wrote `COVERAGE.md` and edited ROADMAP.md's Phase 4 plan
      list unasked; estimates are its own (`confidence: low`).

#### P4-DC-07: Plan 04-01 executor choices (agent listing)

- **Phase / source:** executor for 04-01 (`04-01-SUMMARY.md`).
- **Severity:** Low, except item 2 (Medium: changes generated bytes).
  **Status:** open.
- **Items:**
  1. The fallback warning fires whenever `description` is missing, even when
     `when_to_use`/`when-to-use` supplies the listed text (plan behavior rows).
  2. A present description is now trimmed (upstream `zie` trims), so
     re-staging changes the bytes of an agent whose description had
     surrounding spaces.
  3. An existing flat-discovery unit case was rewritten (its expectation
     contradicted D-CF4-01), against the plan's "keep every case" line.
  4. The settings merge (`withSetting`, `mergeUserSetting`) is private to
     `listing.steps.ts`; it writes two-space JSON, not Pi's key order.
  5. The builtins control pins pi-subagents 0.84.0's 12 builtin descriptions
     as literals; an upgrade that rewords one breaks it.
  6. Expected listing order is pi-subagents' own name sort, measured.
  7. The declared-file scenario writes its file with the frozen generic file
     Given (the file lives outside `agents/`).
  8. Deviations: the advertised-agents lookup was moved into a private helper
     to clear a fallow clone with the frozen `model.steps.ts` and Phase 2's
     `skill/frontmatter.steps.ts` (no marker); the plan's start commit is
     recorded in the executor scratch folder (the worktree guard blocks
     `.git` writes).
- **Parent lines from 04-01:** a CHANGELOG bullet; `shared/fs-utils.ts`
  `isPlainMarkdownFile` doc comment still names the agents bridge;
  `docs/prd/pi-claude-marketplace-prd.md:471` still states the old fallback.

#### P4-DC-08: Wave 2 executor choices (04-02 conversion, 04-03 companion and trust, 04-04 lifecycle)

- **Phase / source:** executors for 04-02, 04-03, 04-04 (their SUMMARYs).
- **Severity:** Medium for 04-03 item 1 and 04-02 item 1; the rest Low.
  **Status:** open.
- **04-02 (frontmatter conversion):**
  1. `background: 'true'` (single-quoted) counts as true, like `true` and
     `"true"`; an agent that runs MCP tools gets no `async` line even with
     `background: true` (pi-subagents' own default is background).
  2. `originalModel` and the unknown-model warning keep the untrimmed source
     value; the thinking-fallback warning quotes the raw effort value while
     the emitted level is normalized.
  3. A quoted tool item with a space splits inside the quotes
     (`["Read Grep"]` gives `"Read` and `Grep"`); upstream would give two
     tools. Scenario (G) writes `tools: *` unquoted.
  4. `MODEL_MAP` became a `Map`; one skill-reference unit test now expects a
     tab to split a reference (D-CF4-08); `stage.test.ts` model lines edited
     in Task 2 although listed only in the plan's file list.
  5. Found, not fixed by the executor: `TOOL_MAP` is a plain object, so
     `tools: constructor` matches a built-in key (pre-existing bug).
- **04-03 (companion missing, trust):**
  1. An install without pi-subagents reports `warning` (SEV-01
     `companionSeverity`), not the plan's `info`; pinned as today's behavior.
     Reinstall reports `info` for the same missing companion (parent line).
  2. `project-trust.feature`'s description grew to four lines; scenario D
     reuses the seed's full call table; companion scenario C starts no new
     session after the profile Pi starts.
  3. The untrusted default-scope text and the trust-blind list were measured
     and recorded in the SUMMARY, not pinned (D-CF4-09).
- **04-04 (lifecycle):**
  1. The profile Pi with pi-subagents and the hidden-builtins Given moved to
     the top of the Background, before the install (the shared Pi has no
     pi-subagents, so its install warns); every verb runs through that Pi.
  2. The update scenario's new body is not observed; closing model replies
     are free text past the compared calls; tables aligned by a scratch
     script (no Gherkin formatter in the repo).

#### P4-DC-09: Plan 04-05 executor choices (skill preload, child runs, AGT-04 gap)

- **Phase / source:** executor for 04-05 (`04-05-SUMMARY.md`).
- **Severity:** Low, except item 1 (Medium: which skills preload).
  **Status:** open.
- **Items:**
  1. Only `description` and `when_to_use` make a skill preloadable; the
     hyphenated `when-to-use` does not (plan and upstream pool rule).
  2. The skill body is trimmed whether or not it has frontmatter; frontmatter
     that parses to a non-object counts as "no description"; the unparseable
     warning omits "(Claude Code skips it too)"; a skipped skill named twice
     warns once; the agent body loses trailing blank lines only when a skill
     is inlined.
  3. Preloads are read in parallel and the first read error rejects the stage;
     a skill row no agent names is never read.
  4. Scenario (C) (`disable-model-invocation` skipped) failed before the change
     (pi-subagents wrote two stray blank lines), so it counts as a red proof
     and the seed is the negative control, as the plan allows.
  5. Scenario (F) records the observed child tools `read`, `bash`,
     `contact_supervisor` (no `bg_wait`); (E) records the plugin row's
     `requires pi-subagents` reason.
  6. Orchestrator-assigned bug fix: `TOOL_MAP` is now a `ReadonlyMap`
     (`tools: constructor` threw, `disallowedTools: constructor toString`
     wrote function source); `THINKING_VALUES` and `SUPPORTED_SOURCE_FIELDS`
     are Sets and unaffected.
  7. AGT-04 stays a recorded gap: pi-subagents' `HOST_PEER_ALIASES` maps the
     bare `@earendil-works/pi-ai` to `./compat` by prefix, so the scripted
     model's faux import resolves under `compat.js`; the parent/child call race
     also remains. Fix routes (parent lines): change the frozen scripted
     model's import, or report the alias-prefix problem to pi-subagents.

#### P4-DC-10: Plan 04-06 gate choices and wave gates

- **Phase / source:** executor for 04-06 (`04-06-SUMMARY.md`); orchestrator wave gates.
- **Severity:** Low. **Status:** open.
- **Gate results:** wave gates `npm run check` exit 0 (seeds 173100, 158544,
  419001); phase gate on b18b16a: `npm run check` exit 0 (seed 745081,
  1255/1255), `npm run test:modules` exit 0, `npm run test:cucumber` twice
  (seeds 325268, 324634, 1255/1255 each), `fallow dupes` clean.
- **Items:** the gate ran once on the base (equal to the combined tree);
  `metrics.started` is estimated; the pi-subagents report's repros are
  described from measured texts (item 1 uses a plain project agent, item 2
  names `createFauxCore`); item 2's fix names two options without checking
  jiti exact-match aliases; two CHANGELOG sub-bullets exceed one sentence; the
  "old files" sub-bullet leaves out `apply`; the `info.ts` line is narrowed to
  the source-reading view; decision rows cite `P4-DC-NN` IDs, which the parent
  renumbers when merging the log; D-CF4-11..13 carry no "settled
  autonomously" tag (CONTEXT does not mark them).

#### P4-DC-11: Verification-step choices (Nyquist, security, code review, regression gate)

- **Phase / source:** verify:post subagents (validate-phase, secure-phase),
  code review and fixer, orchestrator regression gate.
- **Severity:** Medium for items 4 and 5; the rest Low. **Status:** open.
- **Items:**
  1. validate-phase and secure-phase ran as general-purpose subagents (as
     DC-22 C); both reused the phase gate instead of re-running it.
     Nyquist: 0 gaps, AGT-04 counted COVERED by the recorded gap plus the
     pinned `Async: true` line, with the real background run manual-only.
  2. Security: 19 threats (package-install rows of six plans counted as one),
     15 mitigated, 4 accepted, 0 open. Not registered: the preload reader's
     `readFile` follows a symlinked `SKILL.md` swapped in after discovery
     (only the plugin's own author could do it).
  3. Code review ran without subagents (the reviewer could not spawn any):
     round 1 one warning, three info; WR-01 fixed (`Skill(spec)` maps to the
     Skill tool, red-proofed scenario). The three info findings were deferred
     with reasons by the fixer: IN-01 a full `claude-*` ID keeps a `[1m]`
     suffix Pi cannot resolve; IN-02 the thinking-fallback warning quotes the
     raw effort; IN-03 `agents/.md` or an unsafe nested folder name now fails
     the whole install (the old flat walk skipped dotfiles).
  4. WR-01 widens a pattern grant: `tools: Skill(helper)` gives the child all
     skills (pi-subagents cannot limit inheritance to one skill).
  5. A non-conforming commit is on the branch: `72f9a02 docs(04): record code
     review disposition`, made by the disposition step's `gsd-tools query
     commit` (phase number in the title, no trailers). It is pushed; amend
     and rebase are forbidden, so it stays (a squash merge removes it).
  6. The regression gate reuses the post-review `npm run check` (exit 0,
     seed 17555, 1256/1256), which runs every prior phase's tests, instead of
     a separate run over Phase 1's listed test files.

#### P4-DC-12: Phase transition done without PROJECT.md edits

- **Phase / source:** Phase 4 transition (post-completion mode).
- **Severity:** Low. **Status:** open.
- **Choice:** `phase.complete` advanced STATE.md to Phase 2 (the first
  incomplete phase on this branch, which the parent is finishing). The
  transition's `evolve_project` step was skipped: PROJECT.md Key Decisions and
  requirement moves are parent lines (`04-06-SUMMARY.md`), per the child brief,
  to avoid conflicts across five parallel branches. STATE.md got a minimal
  update (focus, recent decisions, two concerns, session continuity).
  graduation_scan is a no-op (`features.global_learnings` off).
- **Verification:** `04-VERIFICATION.md` status `passed` (5/5 must-haves);
  verifier choices: AGT-05 recovery is simulated by a new Pi with the
  companion (Pi cannot add an extension to a running process), XK-01 counts
  the system-prompt placement (D-CF4-04), `--map-model` parity is shown
  through `get` output and the unknown-model error.

Source: `.planning/phases/04-agents/04-DUBIOUS-CHOICES.md`.

### Phase 5 (Hooks): Dubious Choices Log

The Phase 5 child session's review queue for the choices it made without the
user. It has the same shape as the root `.planning/DUBIOUS-CHOICES.md`
(DC-01..DC-27), and the parent merges it into that file. Only the Phase 5
session writes this file. Each subagent ends its report with a
`## Dubious Choices` section, and the session copies the items here.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call that a reviewer may reverse at low cost. Low:
  process, naming, or tooling.
- **Status.** `open` until the user reviews it; the user marks it `accepted`,
  `reversed`, or `follow-up`.


#### P5-DC-01: Commit trailers name this child session, not the parent session

- **Phase / source:** Phase 5 child session, git process.
- **Severity:** Low. **Status:** open.
- **Choice:** Commits on `features/component-features-phase-5` end with
  `Claude-Session: https://claude.ai/code/session_01EDUMG8q84hyEek3xsuxpLu`,
  the session that made them.
- **Alternatives:** The `Claude-Session` line in
  `.planning/CHILD-SESSION-BRIEF.md`
  (`session_01EDUMG5ARYqF6oZYKmj6oB3`), which names the parent session.
- **Why dubious:** The brief says "End every commit message with exactly" that
  line. The session's own attribution instruction names this session, and a
  trailer that names the session that made the commit keeps the record
  traceable.
- **Recorded in:** every Phase 5 commit message.

#### P5-DC-02: Phase 5 discuss decisions settled without the user

- **Phase / source:** Phase 5 smart discuss (child session, research agents A, B, C).
- **Severity:** Medium. **Status:** open.
- **Choice:** All FG-20..FG-26 items, the compaction order, the SSDEDUP-01 key,
  the MCP proxy event, parallel hooks, and dedupe are settled from upstream
  probes and binary greps as D-CF5-01..22 in `05-CONTEXT.md`, without asking.
- **Alternatives:** Stop and ask the user, as ROADMAP's "the user's answers to
  FG-20 and FG-21 as one batch" says.
- **Why dubious:** The roadmap named FG-20/FG-21 as user questions. Each
  choice below has its own entry so it can be reversed.
- **Recorded in:** `.planning/phases/05-hooks/05-CONTEXT.md`.

#### P5-DC-03: Pi `fork` sends SessionEnd `resume`; Pi `reload` runs no session hooks

- **Severity:** High. **Status:** open.
- **Choice:** D-CF5-02 maps Pi `fork` to SessionEnd `resume` (upstream
  `/branch` calls the resume path) and Pi `quit` to `prompt_input_exit` in TUI,
  `other` elsewhere. D-CF5-03 runs neither SessionStart nor SessionEnd on Pi
  `/reload`, as upstream `/reload-plugins`.
- **Alternatives:** `other` for `fork` and `reload`; SessionStart `startup`
  on reload; keep `reload` as a Pi-gap value.
- **Why dubious:** The `fork`->`resume` mapping comes from reading `/branch`
  in the binary; `/branch` is interactive only and was not probed. Users with
  cleanup hooks lose the run on reload. The `logout` matcher is admitted
  although it never fires (upstream also never sends it).
- **Recorded in:** D-CF5-02, D-CF5-03.

#### P5-DC-04: Deviations licensed by phase ownership, not by upstream or Pi

- **Severity:** High. **Status:** open.
- **Choice:** Three items stop short of parity because the fix lives in files
  another phase or the parent owns: D-CF5-20 reports a manifest/marketplace-
  entry `hooks` field as `{unsupported hooks}` instead of merging it (upstream
  merges); D-CF5-08 tells existing partial installs to `reinstall` instead of
  healing them in `apply`; D-CF5-06 keeps `startup` for Pi `--resume`/`--fork`
  launches (the harness launcher is frozen).
- **Alternatives:** Implement the merge and the reconcile growth move now,
  touching orchestrators (`install-outcome.ts`, `enable-disable.ts`,
  `install-cascade.ts`, `reconcile/convergence.ts`).
- **Why dubious:** The parity rule names only a decision ID or a Pi gap as
  licenses; the child-session brief asks for zero edits outside ownership.
  Each deferral has a BACKLOG parent line. D-CF5-20 still edits
  `domain/hooks-resolution.ts` minimally, which no phase lists.
- **Recorded in:** D-CF5-06, D-CF5-08, D-CF5-20.

#### P5-DC-05: Parallel hook execution supersedes DISP-04

- **Severity:** Medium. **Status:** open.
- **Choice:** D-CF5-09 runs matching hooks in parallel with a deterministic
  fold, as upstream, replacing the v1.13 DISP-04 sequential fan-out.
- **Alternatives:** Keep sequential and record a divergence.
- **Why dubious:** A large change in `dispatch.ts`; a later hook's side
  effects now happen even when an earlier one blocks; the recorder's line
  order becomes nondeterministic, so scenarios key runs by hook name.
- **Recorded in:** D-CF5-09.

#### P5-DC-06: MCP proxy outer call runs no hook

- **Severity:** Medium. **Status:** open.
- **Choice:** D-CF5-12: a call-mode `mcp` proxy event fires no hook; the
  nested call fires once under the real tool name. Non-call actions still
  fire as `mcp`.
- **Alternatives:** Map the outer call to the inner name and skip the nested
  one; keep firing both (today's double fire for match-all hooks).
- **Why dubious:** Calls the adapter runs inside the proxy without a nested Pi
  call (its fallbacks) then reach no hook at all, so a policy hook can be
  bypassed on those paths; today a match-all hook could block them as `mcp`.
- **Recorded in:** D-CF5-12.

#### P5-DC-07: systemMessage severity and the extra decision fixes

- **Severity:** Low. **Status:** open.
- **Choice:** D-CF5-14 uses `info` severity (stream-json says `notice`; docs
  say "Warning message") and also shows SessionStart's message (medium
  evidence). D-CF5-11 makes PreToolUse `ask` confirm in the TUI and block
  elsewhere, ignores `defer` (Pi gap), and lets the planner defer uncovered
  decision fixes to BACKLOG.
- **Alternatives:** `warning` severity; scope the decision fixes out.
- **Why dubious:** The probes ran in `-p` only; interactive `ask` was not seen.
- **Recorded in:** D-CF5-11, D-CF5-14.

#### P5-DC-08: Phase 1's empty `transcript_path` finding closed as a harness artifact

- **Severity:** Low. **Status:** open.
- **Choice:** D-CF5-07 keeps `""` for a `--no-session` Pi (Pi gap) and closes
  the finding: a saved Pi session sends a path from the first turn.
- **Alternatives:** Invent a path for in-memory sessions, as upstream does
  under `--no-session-persistence`.
- **Why dubious:** A hook that calls `Path(transcript_path)` in Python sees
  the current directory for `""`.
- **Recorded in:** D-CF5-07.

#### P5-DC-09: UI design-contract step skipped on a false frontend match

- **Severity:** Low. **Status:** open.
- **Choice:** `check ui-plan-gate 5` answered `frontend: true` from the token
  "form" with no frontend evidence; `ui_phase` is false. The step was skipped,
  as DC-11 did for Phase 1.
- **Alternatives:** Run `gsd-ai-integration-phase 5`, the only `plan:pre`
  step hook with a skill.
- **Recorded in:** this file.

#### P5-DC-10: Research open questions settled by the session

- **Severity:** Medium. **Status:** open.
- **Choice:** D-CF5-23..28 in `05-CONTEXT.md`: skip `if` hooks on tool-less
  events (upstream); one `HookSurface` kind for every hook notice; one Stop
  feedback message with a paragraph per reason, first deny reason wins;
  `/reload` through the TUI driver and resume unit-tested only; a manifest
  `hooks` string naming `hooks/hooks.json` is not partial; `tool_use_id` and
  `mcp_server` deferred; four waves instead of three.
- **Alternatives:** A second notice kind; one message per Stop reason; a
  hook-owned Pi extension to trigger reload; adding the stdin extras now.
- **Why dubious:** Upstream's choice among several deny reasons was not
  probed; the TUI reload scenario's stability is unverified; the researcher
  ran spike scenarios from the scratchpad (no repo edit).
- **Recorded in:** `05-CONTEXT.md` "Planning clarifications", `05-RESEARCH.md`.

#### P5-DC-11: Project-scope hook provenance check (D-CF2-13) deferred to the merge

- **Phase / source:** parent note to the Hooks phase (2026-11-01).
- **Severity:** High. **Status:** open.
- **Choice:** Phase 5 does not add the D-CF2-13 provenance check to
  project-scope hooks, because the ledger module
  (`bridges/skills/project-installs.ts`) is not on this branch yet. A parent
  line in the last plan's SUMMARY asks for the hydrate of project-scope hooks
  to consult the generalized ledger (kind `hooks`) after the merge.
- **Alternatives:** Build a hooks-only ledger now (a second file the parent
  would need to reconcile); wait for the parent to merge Phase 2 first.
- **Why dubious:** Until then, project-scope hooks from repository-controlled
  state can run commands with no provenance check (pre-existing exposure).
- **Recorded in:** the last plan's SUMMARY "Parent lines".

#### P5-DC-12: Phase 5 planning choices

- **Phase / source:** gsd-planner (8 plans, 4 waves) and the pattern mapper.
- **Severity:** Medium. **Status:** open.
- **Choices:**
  1. Four waves instead of the ROADMAP's three; both wave-3 plans depend on
     every wave-2 plan, which serializes the waves.
  2. `onFailure` lands in wave 1 (05-02), reading the field through the
     handler index signature; 05-04 adds it to the schema in wave 2.
  3. The notice kind is named `hook-notice`; error notices use `info`
     severity; exit-2 block notices also show on SessionStart, SessionEnd,
     and PostCompact (beyond D-CF5-24); the blocked-prompt notice leaves out
     upstream's "Original prompt:" line.
  4. `ask` stays a mutate `permissionDecision` with no new result arm; the
     PreToolUse block reason uses upstream's text (D-CF5-11).
  5. The prompt-context buffer sits beside the SessionStart buffer (different
     lifetimes).
  6. Deferred to BACKLOG parent lines: PostToolUse `continue:false`, a Stop
     hook error notice, non-blocking error notices for exits other than 0 and
     2, PreCompact exit-2 blocking, the `updatedToolOutput` shapes.
  7. If the TUI driver is flaky, the TUI reload and quit scenarios fall back
     to unit tests. Async-rewake substitution and the Stop/async `onFailure`
     ignore are unit-tested only. The second-compaction scenario states only
     the second run.
  8. D-CF5-20's "info names it" is met through the unsupported reason only.
  9. Threat T-05-28 (project-scope hooks without provenance, high) is
     `transfer` to the merge (P5-DC-11), which `/gsd-secure-phase` may flag.
     The guard insertion point is named as `tryHydrateOnePlugin`; a second
     routing-cache writer (`readAndCachePluginHooksWith`) is named for the
     parent.
  10. `planSpawn` substitution takes the three path values, not the env
      (pattern mapper; avoids unreachable `?? ""` branches).
  11. Unverified assumptions: how plain stdout is trimmed, and the
      `[command]` text in `onFailure` messages.
- **Recorded in:** `05-0*-PLAN.md`, `05-PATTERNS.md`.

#### P5-DC-13: Plan-check revision: a 25-file plan accepted, five waves

- **Phase / source:** plan checker iteration 1 and the planner's revision.
- **Severity:** Low. **Status:** open.
- **Choice:** The old 05-07 was split: 05-07 keeps the `hook-notice` kind
  with its first caller (25 files, justified in its "Scope note" because the
  kind must land in one commit), the new 05-08 owns tool context and Stop, and
  the gate plan became 05-09. Phase 5 now has 9 plans in 5 waves (supersedes
  P5-DC-12's "8 plans, 4 waves"). 05-01, 05-02, 05-06 keep 15-18 files with a
  scope note. The 05-06/05-07 ordering is `coupling_justified`, not a
  dependency.
- **Alternatives:** Spread the kind over two commits (red tree between them);
  six waves with a dependency.
- **Why dubious:** The per-plan budget is exceeded by design; the coupling
  justification holds only if 05-07's tests never assert a context value.
- **Recorded in:** `05-07-PLAN.md` "Scope note", `05-08-PLAN.md`, `05-09-PLAN.md`.

#### P5-DC-14: Executor prompts read the GSD execution files by path

- **Phase / source:** Phase 5 execute-phase orchestration.
- **Severity:** Low. **Status:** open.
- **Choice:** As DC-17 did for Phase 1, each executor prompt names
  `execute-plan.md`, `summary.md`, `checkpoints.md`, `tdd.md`,
  `worktree-path-safety.md`, and `executor-examples.md` by absolute path for
  the executor to read, instead of inlining their text. The worktree branch
  check is embedded verbatim.
- **Alternatives:** Inline the files verbatim, as the workflow says.
- **Why dubious:** Departs from the literal build-time embed instruction; an
  executor that skipped a read would miss the contract.
- **Recorded in:** this file.

#### P5-DC-15: Wave 1 executor choices (05-01 session tracer, 05-02 process)

- **Phase / source:** executors of 05-01 and 05-02.
- **Severity:** Medium. **Status:** open.
- **05-01:**
  1. Terminal (TUI) scenarios start a profile Pi and install to the user
     scope through it, instead of using the shared Pi: the shared Pi kept the
     plugin's SessionEnd hook routed and recreated `<home>/harness` in the
     next scenario's reset.
  2. Edited two byte cases in `test/bridges/hooks/dispatch-exec.test.ts`
     (05-02's file); the merge was clean.
  3. A failed compaction SessionStart leg logs and still runs PostCompact; a
     stale generation stops both.
  4. The terminal Given polls the hook log every 50 ms (30 s cap) for the
     `startup` run.
  5. The `compact_summary` literal is Pi's own split-turn summary text, so it
     changes if Pi changes that text.
  6. The session-id projection applies to every cell, not only
     `CLAUDE_ENV_FILE`.
  7. Task 3's red run restored base sources temporarily (not committed).
- **05-02:**
  1. Edited one line of `runs.steps.ts` (05-01's file) so the `arguments`
     cell gets run-token projection; also `test/bridges/hooks/runtime.test.ts`
     (outside its file list) for the new `TimerLadder.fired()`.
  2. The `onFailure` message drops `\n<stderr>` when stderr is empty; broken
     JSON reports the hook's stderr; the `onFailure` check runs before the
     parse, so exit 1 with valid deny JSON blocks with the `onFailure`
     message (upstream order unprobed).
  3. The "ignored" debug line for Stop/async `onFailure` fires on every run.
  4. `TimerLadder.fired()` is true only when SIGTERM reaches a child still
     running at its deadline (HKDR-01 grandchild case not counted).
  5. Script hooks need a `dir` or `file` publication (mode bit).
- **Recorded in:** `05-01-SUMMARY.md`, `05-02-SUMMARY.md`.

#### P5-DC-16: Wave 2 executor choices (05-03 tool use, 05-04 configuration, 05-05 lifecycle)

- **Phase / source:** executors of 05-03, 05-04, 05-05.
- **Severity:** Medium. **Status:** open.
- **05-03:**
  1. On an exit other than 0 and 2, a JSON object on stdout is applied whole
     ("the fields alone decide"); a signal kill and plain stdout stay noop.
  2. Default reasons taken from the binary: `[<command>]: No stderr output`,
     `Blocked by hook`; `Operation stopped by hook` for `continue:false`
     without `stopReason` (not verified upstream).
  3. `ask` without a terminal blocks with the hook's reason alone; an `ask`
     without a reason uses Pi's default block text; the TUI dialog wording
     (`PreToolUse:<Tool> hook asks to allow this call`) is the bridge's own.
  4. One type assertion widens `tool_result` content past the frozen
     `pi-api.ts` text-only type (parent line to widen it).
  5. Contexts: empty ones dropped; the SessionStart buffer now holds one joined
     entry (before, only the last hook's context survived).
  6. `applyMutationInPlace` and its three tests removed; the dispatch-level
     UserPromptSubmit context case deleted, not moved (fallow clone).
  7. Tests outside its list edited minimally: `dispatch-exec.test.ts`,
     `event-router.test.ts`, `test/index.test.ts`.
  8. Found, not fixed in 05-03: PostToolUse `updatedToolOutput` edits
     `event.content` in place and returns `undefined`, so Pi 1.4 drops it.
     The session routes the fix to 05-06 (owns `event-adapters.ts` in wave 3)
     under the bug policy.
- **05-04:**
  1. Edited `test/domain/plugin-resolver.test.ts` (3 cases) and
     `test/orchestrators/plugin/list-flow.test.ts` (1 case), which pinned the
     old silent-ignore rule.
  2. A marketplace-entry `hooks` counts in every form; only the manifest gets
     the D-CF5-27 convention-path exception. An empty inline `{}` counts as
     declared; `""`, `null`, `[]`, `[""]` do not.
  3. A whitespace-only `if` on a tool-less event still compiles to match-all
     (upstream skips only an empty `if`).
  4. Info names manifest/entry hooks only through the `unsupported hooks`
     reason (`orchestrators/plugin/info.ts` is not owned).
  5. One commit per TDD task (no separate red commit); one style-only commit.
- **05-05:** no product change; the update scenario checks hook runs, not
  model calls.
- **Recorded in:** `05-03-SUMMARY.md`, `05-04-SUMMARY.md`, `05-05-SUMMARY.md`.

#### P5-DC-17: Wave 3 executor choices (05-06 additional context, 05-07 hook notices)

- **Phase / source:** executors of 05-06 and 05-07.
- **Severity:** Medium. **Status:** open.
- **05-06:**
  1. Edited two cases in `test/bridges/hooks/dispatch.test.ts` (05-07's file)
     for the returned `updatedToolOutput` patch; merge was clean.
  2. Plain-text context follows the documented rule: stdout not starting
     with `{` and ending with `}` is plain text (a JSON array or number
     counts as context); braced stdout that fails to parse adds nothing;
     multi-line JSON is a parse failure (upstream edge not probed).
  3. Context reaches the model as one hidden custom message
     (`claude-hook-additional-context`, `display: false`), one text part per
     event; upstream injects a system-reminder in the same request.
  4. Whitespace-only context is dropped when the message is built; a prompt
     queued while streaming sends its context with the next run (not probed).
  5. The `updatedToolOutput` fix (routed by the session) is pinned by unit
     cases and an uncommitted probe scenario; the session routes the
     committed scenario to 05-08, which owns `tool-use.feature`.
  6. A type assertion keeps 100% branch coverage in `wire-protocol.ts`.
- **05-07:**
  1. Session notices are labelled `<Event>:<value>` (`SessionStart:clear says:
     ...`), not D-CF5-14's literal `<Event>[:<Tool>]`; SessionStart is verified
     upstream, SessionEnd and PostCompact by inference.
  2. The kind has one severity, `info`; upstream draws the blocked-prompt
     message as a warning and the hook error in the error colour.
  3. Exit-2 blocks on SessionStart, SessionEnd, PostCompact are reported too;
     a blocked prompt still shows its hooks' system messages first (unverified
     upstream); UserPromptSubmit `continue:false` shows no notice (BACKLOG).
  4. `HOOK_NOTICE_PAYLOAD` sits before the `internal-error` arm, moving it from
     index 22 to 23; an extra step `the hooks show the user no messages`.
  5. A manual TruffleHog run flags existing fake `ghp_` fixtures as verified
     through the proxy; commits ran without any skip.
- **Recorded in:** `05-06-SUMMARY.md`, `05-07-SUMMARY.md`.

#### P5-DC-18: Wave 4 executor choices (05-08 tool context and Stop feedback)

- **Phase / source:** executor of 05-08.
- **Severity:** Low. **Status:** open.
- **Choices:**
  1. A Stop block with no reason still re-enters with an empty
     `Stop hook feedback:\n` part (upstream requires `reason`; not probed).
  2. A Stop hook that blocks and gives `additionalContext` sends two parts,
     reason first (not probed).
  3. The re-entry's `details.pluginId` and the STOP-07 cap notice name the
     first hook that sends feedback (before: the first blocking hook).
  4. Tool context uses its own custom type `claude-hook-tool-context`, not
     05-06's `claude-hook-additional-context` (that constant lives in
     `event-router.ts`, not owned by 05-08).
  5. Tool context is sent even after a PreToolUse `continue:false`; Stop
     notices show before the re-entry decision, so also under `continue:false`.
  6. The new When requires the prompt disposition `started`; the routed
     `updatedToolOutput` scenario is its own test-only commit.
- **Recorded in:** `05-08-SUMMARY.md`.

#### P5-DC-19: Docs and gate plan choices (05-09)

- **Phase / source:** executor of 05-09.
- **Severity:** Low. **Status:** open.
- **Choices:**
  1. `docs/hooks-compatibility.md` downgrades five rows from ✓ to ⚠ where a
     plan measured a gap (PreCompact exit 2 does not stop compaction; "other
     exit" stderr not shown; `continue:false` on PostToolUse only logs and on
     UserPromptSubmit gives no notice; `updatedToolOutput` reads only Pi's
     content array; `transcript_path` is `""` under `--no-session`) and raises
     PostCompact to ✓.
  2. Fixed two TOOL-02 comments in `hook-events.ts` that said "unavailable"
     where the code gives "partially-available".
  3. Left the stale `bypass_permissions_disabled` in
     `docs/research/claude-hook-config-syntax.md:103` as a parent line (file
     outside the plan; D-CF5-21 says such mentions are removed).
  4. The session events table lists Pi `/new` beside RPC `new_session` and
     saved-session resume as `resume`; scenarios drive only RPC `new_session`,
     resume is unit-tested only.
  5. Decision rows mark D-CF5-06, 08, 16, 20, 28 "Deferred", the rest "Locked".
  6. The GSD plan-commit ledger write was refused by the worktree guard, so
     `plan_head_before` is the known base `df1a1fbc`.
- **Gate:** the merged tree's build inputs equal the gated commit `e3f0676`, so
  the session reused 05-09's phase-gate result instead of rerunning it.
- **Recorded in:** `05-09-SUMMARY.md`.

#### P5-DC-20: Security audit closures that rest on judgment

- **Phase / source:** `/gsd-secure-phase 5` (security auditor), 31/31 closed.
- **Severity:** Medium. **Status:** open.
- **Choices:**
  1. T-05-28 (project-scope hooks with no D-CF2-13 provenance check, high) is
     CLOSED by documented transfer only; the exposure is live on this branch
     until the parent applies the guard (P5-DC-11) and re-runs
     `/gsd-secure-phase` after the merge.
  2. T-05-23 (escape sequences in hook-notice text) is closed at L1; hook
     notice text reaches `ctx.ui.notify` verbatim, with no control-character
     filter (open at L2, low).
  3. T-05-12 (outer `mcp` proxy runs no hook, D-CF5-12) is an accepted
     medium policy-bypass risk for adapter paths without a nested Pi call.
  4. The five accepted risks are persisted as AR-05-01..05 in `05-SECURITY.md`.
  5. Unregistered flag: the routed `updatedToolOutput` fix (`6bbe6ba`) lets a
     plugin hook replace the tool output the model reads (upstream parity;
     content whitelist in place), with no threat ID.
  6. Fail-open edges noticed, not registered: stdout/stderr overflow settles
     `noop` before the `onFailure` check; a generation change mid-bucket drops
     a computed deny. Handed to code review.
- **Recorded in:** `05-SECURITY.md`.

#### P5-DC-21: Nyquist gap fill exposed a PostToolUseFailure stdin divergence

- **Phase / source:** `/gsd-validate-phase 5` (Nyquist auditor) and the session.
- **Severity:** Medium. **Status:** open.
- **Choice:** The auditor's only gap (HOOK-04 had no PostToolUseFailure
  scenario) was filled with a scenario that showed the bridge sends
  `tool_response`, while Claude Code 2.1.316's schema sends `error: string`
  (binary grep). Under the bug policy the session dispatched a fix in the
  same phase: `error` carries the joined text parts of Pi's content, and the
  scenario pins upstream's shape. `tool_use_id`, `is_interrupt`, and
  `duration_ms` stay deferred (D-CF5-28).
- **Alternatives:** Pin today's `tool_response` shape and record a divergence.
- **Why dubious:** Found after the plans ran, so the fix was not planned; a
  plugin that read `tool_response` on PostToolUseFailure (non-upstream) would
  break.
- **Recorded in:** `05-VALIDATION.md`, the fix commit.

#### P5-DC-22: Code review fixes and the D-CF5-09 rewrite rule

- **Phase / source:** `/gsd-code-review 5 --fix --auto` (reviewer and fixer).
- **Severity:** Medium. **Status:** open.
- **Choices:**
  1. WR-01 skipped and D-CF5-09 reworded: the input rewrite is the last one in
     routing order whatever the hook decided, as upstream's fold (`jFt`) keeps
     the last `updatedInput` (the old wording "of the winning decision"
     contradicted E11). Upstream uses finish order; the bridge uses routing
     order for determinism.
  2. WR-02: a steer's or follow-up's prompt context reaches the model just
     before the queued prompt, not after it (Pi gap: no carrier after a queued
     prompt), documented in `docs/hooks-compatibility.md`.
  3. WR-03: hook notices lose control characters (except line breaks and tabs)
     and are cut at 2,000 user-visible characters with `… (+N chars)`; the cap
     is the fixer's choice (no upstream cap found).
  4. WR-04: a PreCompact block now cancels the compaction (upstream stops it
     and reports `Compaction blocked by PreCompact hook: ...`); the notice is
     `info`, not upstream's warning (new severity would extend the closed set).
  5. CR-01: only the bridge's own overflow kill counts as an `onFailure`
     failure; a hook that exits 0 after overflowing stays a noop.
  6. One fix commit (`0df61e7`) ran its hook without the non-DAC env; the hook
     still passed.
  7. IN-01 (generation-change discard) refuted as intended (DISP-03); the six
     info findings were left out of the fix scope.
- **Recorded in:** `05-REVIEW.md`, `05-REVIEW-FIX.md`, `05-CONTEXT.md` D-CF5-09.

#### P5-DC-23: Code review iteration 2 fixes

- **Phase / source:** `/gsd-code-review 5 --fix --auto`, iteration 2 fixer.
- **Severity:** Medium. **Status:** open.
- **Choices:**
  1. CR-01: an output overflow no longer kills the hook; the bridge drains past
     its EXEC-02 caps (1 MB stdout, 64 KB stderr) and the exit code decides,
     so an exit-2 deny is never lost. Upstream keeps all output; stdout cut at
     the cap is not read as JSON, so a JSON answer over 1 MB is lost (no D-CF5
     ID; EXEC-02 cited in the docs). A hook that writes forever now runs to
     its timeout.
  2. WR-01: every PreCompact block cancels the compaction and is named in the
     notice, as upstream's `blockedBy`.
  3. WR-02: a follow-up's prompt context waits in a runtime queue and is sent
     at the `turn_end` whose next queued message has the follow-up's text
     (Pi's `deliverAs` gives the context its own model call in Pi's default
     one-at-a-time mode). Text matching misses expanded follow-ups (skill or
     template), and identical texts could swap contexts; documented.
  4. Removed one `fallow-ignore` code-duplication marker that is no longer
     needed, so `.planning/codebase/CONVENTIONS.md`'s "exactly 41" marker
     count is now 40 (parent line).
  5. `test/index.test.ts` imports `TurnEndEvent` straight from the Pi peer
     because the frozen `platform/pi-api.ts` does not re-export it (parent
     line: re-export it).
- **Recorded in:** `05-REVIEW-FIX.md`.

#### P5-DC-24: Code review stopped at the iteration cap with two open warnings

- **Phase / source:** `/gsd-code-review 5 --fix --auto`, iteration 3 (cap 3).
- **Severity:** Medium. **Status:** open.
- **Choice:** The iteration-3 review left 0 critical and 2 warnings, both edge
  cases of the follow-up prompt-context carrier (`a17639b`): (WR-01) a
  follow-up whose UserPromptSubmit hook is still running when the run ends
  loses its context (Pi rechecks `isStreaming` after the input handlers); a
  follow-up queued after the last `turn_end` is read with no `turn_end` before
  it; (WR-02) a terminating tool batch (a PreToolUse `continue:false`) and
  `followUpMode: "all"` read follow-ups the bridge does not send context for.
  They are not fixed in this phase; both go to BACKLOG parent lines with the
  reviewer's suggested fix (check `ctx.isIdle()` in `queuePromptContext`,
  match `event.prompt` in `before_agent_start`, send all matching queued
  follow-ups). The 12 info findings stay open in `05-REVIEW.md`.
- **Alternatives:** A fourth fix pass beyond the workflow's cap.
- **Why dubious:** The main follow-up path is right; the edge cases lose hook
  context silently (debug line only), which D-CF5-13's intent forbids.
- **Recorded in:** `05-REVIEW.md` (iteration 3), this entry.

#### P5-DC-25: Transition run without PROJECT.md edits; security audit not re-run after fixes

- **Phase / source:** Phase 5 transition (post-completion mode) and verification.
- **Severity:** Low. **Status:** open.
- **Choices:**
  1. `evolve_project` was skipped: the child-session rules forbid PROJECT.md
     edits, and `05-09-SUMMARY.md` carries the PROJECT.md parent lines (the 28
     D-CF5 rows, the line-1344 correction). STATE.md got only its focus and
     progress lines; decisions and blockers sections are left to the parent's
     merge to avoid conflicts with sibling phases.
  2. `05-SECURITY.md` was audited at `b5ff1e7`, before the code-review fix
     commits `0d877aa`..`a17639b` (overflow handling, notice escape stripping,
     follow-up context queue). Those fixes strengthen mitigations and were
     reviewed by three review passes, but no second security audit ran; the
     parent's post-merge `/gsd-secure-phase` (T-05-28) can cover them.
  3. `phase.complete` reported "files not on disk" warnings for command
     strings in the SUMMARYs; they are parser false positives.
- **Recorded in:** this file.

Source: `.planning/phases/05-hooks/DUBIOUS-CHOICES.md`.

### Phase 6 (MCP Servers): Dubious Choices Log

Choices made without the user in the Phase 6 child session
(`features/component-features-phase-6`). Same shape as the root
`.planning/DUBIOUS-CHOICES.md`; the parent merges these entries into it.
Severity: High changes what a user sees or diverges from upstream; Medium is a
judgment call a reviewer may reverse at low cost; Low is process, naming, or
tooling. Status stays `open` until the user reviews it.


#### P6-DC-01: MCP server sources merge as upstream (MC-1 superseded)

- **Phase / source:** Phase 6 smart discuss (D-CF6-01, FG-27).
- **Severity:** High. **Status:** open.
- **Choice:** A plugin's MCP servers become the union of `.mcp.json` and the
  declared `mcpServers` values, with a later same-name server replacing an
  earlier one, replacing PRD MC-1's "first match wins, no merge".
- **Alternatives:** Keep MC-1 and record it as a licensed divergence.
- **Why dubious:** MC-1 is a recorded PRD requirement, so it could count as
  a license; it was not chosen for an implementation reason, so parity wins
  under the user's instruction. Plugins that declared the same server in two
  places now install more servers than before.
- **Upstream evidence:** binary 2.1.316 manifest schema text "MCP servers to
  include in the plugin (in addition to those in the .mcp.json file, if it
  exists)"; plugins reference "mcpServers".
- **Recorded in:** `06-CONTEXT.md` D-CF6-01.

#### P6-DC-02: One malformed server is skipped, not the whole plugin

- **Phase / source:** Phase 6 smart discuss (D-CF6-02, FG-28).
- **Severity:** High. **Status:** open.
- **Choice:** Skip a malformed server with an install warning and install the
  rest of the plugin, as upstream does.
- **Alternatives:** Keep `(unavailable) {malformed mcp}` for the whole plugin
  and give it a decision ID.
- **Why dubious:** The docs cite ANAME-07 as the license, but ANAME-07 covers
  unsupported transport features, not malformed servers; a reviewer may read
  "a malformed component makes a plugin unavailable everywhere" as a project
  principle worth keeping.
- **Upstream evidence:** docs (mcp "Invalid server configs"), to be confirmed
  on the binary by the phase researcher.
- **Recorded in:** `06-CONTEXT.md` D-CF6-02.

#### P6-DC-03: Project-scope plugin servers keep adapter approval

- **Phase / source:** Phase 6 smart discuss (D-CF6-03, FG-29).
- **Severity:** Medium. **Status:** open.
- **Choice:** Keep the adapter's project trust (a headless session needs the
  user-global `projectServers: "allow"`) as a licensed divergence, and pin
  the blocked cases.
- **Alternatives:** Write the adapter's approval file at install (outside
  NFR-10's write set); install project-scope servers into the user file.
- **Why dubious:** Upstream never asks to approve a plugin server, so a
  project-scope plugin user sees a prompt or a blocked server that Claude
  Code users never see.
- **Upstream evidence:** docs (Claude Code asks only for project `.mcp.json`
  servers); adapter 7.0.0 `project-server-trust.ts`.
- **Recorded in:** `06-CONTEXT.md` D-CF6-03.

#### P6-DC-04: Phase 6 adds its own stand-ins and agent fixture writer

- **Phase / source:** Phase 6 smart discuss (D-CF6-06, D-CF6-07).
- **Severity:** Low. **Status:** open.
- **Choice:** New stand-ins (such as a loopback HTTP MCP server) live in
  Phase 6-owned `features/lib/mcp-server-*.ts` files, and the MCP-07 agent is
  written by a helper in `mcp-server-files.ts`, not by `agent-files.ts`.
- **Alternatives:** Extend the frozen stub (a parent line); import Phase 4's
  `agent-files.ts`.
- **Why dubious:** The ownership table names only `mcp-server-files.ts` for
  Phase 6's lib; new `mcp-server-*` files widen it. Writing an agent outside
  `agent-files.ts` duplicates a little fixture code.
- **Recorded in:** `06-CONTEXT.md` D-CF6-06, D-CF6-07.

#### P6-DC-05: Commit trailer names this child session

- **Phase / source:** Phase 6 child session, git.
- **Severity:** Low. **Status:** open.
- **Choice:** Commits end with `Claude-Session:
  https://claude.ai/code/session_01EDUMG6ciPE7kp9aMmHch1m` (this child
  session, as the session's own attribution reminder gives), not the parent's
  `session_01EDUMG5ARYqF6oZYKmj6oB3` that the brief prints.
- **Alternatives:** Copy the brief's trailer verbatim.
- **Why dubious:** The brief says "exactly"; the trailer is meant to point at
  the session that made the commit, which is this one.
- **Recorded in:** this file; every Phase 6 commit.

#### P6-DC-06: AI-integration planning step skipped on a keyword match

- **Phase / source:** Phase 6 plan-phase, plan:pre `ai-integration` hook.
- **Severity:** Low. **Status:** open.
- **Choice:** The hook fires because the phase goal says "agents"; the
  phase tests MCP tool calls with a scripted model and builds no AI system,
  so no AI-SPEC.md is generated (as DC-11 did for the UI contract).
- **Alternatives:** Run `/gsd-ai-integration-phase 6`.
- **Recorded in:** this file.

#### P6-DC-07: Research amendments accepted by the orchestrator

- **Phase / source:** Phase 6 researcher (`06-RESEARCH.md`); amendments in `06-CONTEXT.md`.
- **Severity:** High (items 1, 2, 4); the rest Low-Medium. **Status:** open.
- **Items:**
  1. **D-CF6-02 silent skip:** a malformed server in a file, or an unparseable, missing, or unreadable file, is dropped with no warning (upstream's loader is silent; only `claude plugin validate` reports). The earlier "install warning" text is withdrawn. A user loses a server with no message.
  2. **Permission-denied MCP file skipped** (upstream), changing the WR-03 `{permission denied}` classification; proven from binary source only (root container cannot probe it).
  3. **`.mcpb`/`.dxt`** become `{unsupported mcp}` with no named dropped server (no closed-set change).
  4. **D-CF6-10 MCP-07 as a recorded gap:** a foreground pi-subagents 0.84.0 agent cannot use a plugin MCP tool (`Unresolved MCP direct-tool selectors: ...`); the requirement is met by pinning that result, not by a working call. Root cause (possibly a cache-hash mismatch) unproven.
  5. **Reference without `./` kept installable** (upstream refuses the manifest): a divergence recorded under D-CF6-01 to avoid breaking plugins that install today.
  6. **D-CF6-11:** a fresh profile Pi stands in for `/reload` where the harness has no reload step.
  7. **Out-of-ownership test edits:** `test/domain/plugin-resolver.test.ts` (MCPR-03, WR-03, entry-wins, MM-5) changes with the resolver fix.
  8. **Doc finding for Phase 5:** since adapter 6.0 hooks do see proxied MCP calls (nested call under the real tool name); `docs/hooks-compatibility.md` reconciliation is a parent line.

#### P6-DC-08: Planner choices for the nine Phase 6 plans

- **Phase / source:** Phase 6 gsd-planner (`06-01`..`06-09-PLAN.md`).
- **Severity:** Medium (items 2, 3, 5, 6); the rest Low. **Status:** open.
- **Items:**
  1. Four waves, not three: the merge (06-03, wave 2) and the silent skip (06-07, wave 3) are split because both edit `domain/mcp-resolution.ts`; the gate is 06-09 in wave 4, and the docs plan 06-08 runs in wave 3 beside 06-07.
  2. Array-form `mcpServers` is admitted in the owned `domain/components/mcp.ts` (`MCP_SERVERS_SCHEMA`), leaving the unowned `domain/components/plugin.ts` unchanged; its stale comment (lines 48-52) is a parent line. Three cases in `test/domain/components/plugin.test.ts` change expected outcomes only.
  3. Out-of-ownership tests edited under CONTEXT's general clause: `test/domain/components/plugin.test.ts` and `test/orchestrators/reconcile/mcp-migration.test.ts`, each bounded by a `git diff` check.
  4. Paired tests of owned sources treated as owned (`test/domain/mcp-resolution.test.ts`, `test/domain/components/mcp.test.ts`, and, on a measured break, `test/platform/mcp-status.test.ts`, `test/shared/concerns/soft-dep.test.ts`).
  5. Downstream fatal-path tests keep their titles by moving the bad server inline into `plugin.json`; one commit between 06-07 Task 1 and Task 2 leaves those suites red.
  6. I/O errors while locating an MCP file (ENOTDIR and similar) are skipped silently, read as D-CF6-02's "missing or unreadable file".
  7. The Phase 1 `calls.steps.ts` is moved into `listing.steps.ts` and deleted.
  8. `.mcpb` gets no extra note beyond `(partially-available) {unsupported mcp}`.
  9. Two new libs (`features/lib/mcp-server-http.ts`, `features/lib/mcp-server-environment.ts`) beyond the single `mcp-server-files.ts` the ownership table names.
  10. The `MCP_DIRECT_TOOLS` doc row may rest on reading adapter source if a scratch RPC measurement fails.
  11. `COVERAGE.md` declares "No external API integration" against four detector keyword signals.
  12. D-CF6-07 followed over ROADMAP wording ("uses Phase 1's agent fixture writer").
  13. Conditional ownership in wave 2 (`bridges/mcp/**` to 06-02; the soft-dep adapter arm and `mcp-status.ts` to 06-05), only on a measured break; other product breaks hand over to 06-07 with no failing scenario committed.
  14. 06-08 documents the skip rule while 06-07 builds it; 06-09 Task 1 checks the doc against merged code.
  15. 06-09's diff base is the fixed hash `3a7a707`, with a `git merge-base` fallback.
- **Recorded in:** this file; the plans' `<assumption_delta_decision>` and task bodies.

#### P6-DC-09: Plan-checker warnings handled without a revision round

- **Phase / source:** Phase 6 gsd-plan-checker (0 blockers, 2 warnings, 3 info).
- **Severity:** Low. **Status:** open.
- **Choice:** Warning 1 (MCP-07 and ROADMAP SC4 still ask for a working agent call) is fixed in place: 06-09 now carries a parent line to mark MCP-07 "gap-pinned (D-CF6-10)" and amend SC4, and its SUMMARY states SC4 is met by the pin. Warning 2 (commit trailer differs from the brief) is kept as decided in P6-DC-05. The three advisories are left as written: `calls.steps.ts` stays in both `files_modified` and `files_deleted`, the plans keep this session's scratchpad wrapper path (executors run in this session), and 06-09 Task 1 still reconciles 06-08's doc with 06-07's merged code. The checker rated MCP-07's gap a warning rather than a blocker because D-CF6-10 licenses it.
- **Alternatives:** Re-spawn the planner for a revision round; edit REQUIREMENTS.md and ROADMAP SC4 in this phase.
- **Recorded in:** `06-09-PLAN.md` Task 3 parent lines.

#### P6-DC-10: Executor prompts load the GSD procedure files by Read, not inline

- **Phase / source:** Phase 6 execute-phase orchestration (step 3 dispatch).
- **Severity:** Low. **Status:** open.
- **Choice:** Each executor prompt tells the executor to Read `execute-plan.md`, `summary.md`, `checkpoints.md`, `worktree-path-safety.md`, and `executor-examples.md` in full before any work, instead of the orchestrator pasting their ~130 KB verbatim into every prompt. The small `worktree_branch_check` guard is still embedded verbatim with the base SHA substituted. The prompts also carry the brief's git, project, and environment rules and the dubious-choices protocol.
- **Alternatives:** Inline the five files verbatim in every dispatch, as the workflow's build-time-embed note asks.
- **Why dubious:** The workflow's note forbids leaving the content to the executor; the reason it gives (an `@path` line never expands) does not apply to an explicit Read instruction, but an executor that skips the Read would run without the procedure.
- **Recorded in:** this file.

#### P6-DC-11: Plan 06-01 executor choices (listing tracer)

- **Phase / source:** Phase 6 executor for `06-01-PLAN.md` (`06-01-SUMMARY.md`).
- **Severity:** Medium (items 1, 2, 3); the rest Low. **Status:** open.
- **Items:**
  1. **Connect before listing:** the adapter's lazy `mcp({ server })` listing holds an em dash that the `fix-unicode-dashes` pre-commit hook rewrites in every committed feature file, so the scenario lists status, connects, then lists the server; the first listing a model sees is not compared whole. Any adapter message with an em dash has the same limit.
  2. **250 ms quiet window for the registry probe:** the tool-listing When repeats the probe until two reports 250 ms apart agree (15 s deadline), after one flip under 8 workers; a heuristic, not a readiness signal.
  3. **`/** @public */` on 8 fixture-writer exports** nothing imports until wave 2, to pass fallow dead-code without a marker that could go stale; the tags hide dead code until removed (parent line to remove them after wave 2).
  4. Array elements of `mcpServers` are not expanded as stub markers (a server takes its name from a member key).
  5. The MCP-07 agent fixture body text "Call the tools the task names." was chosen by the executor.
- **Recorded in:** `06-01-SUMMARY.md`.

#### P6-DC-12: Plan 06-04 executor choices (tool calls and the agent gap)

- **Phase / source:** Phase 6 executor for `06-04-PLAN.md` (`06-04-SUMMARY.md`).
- **Severity:** Medium (item 1); the rest Low. **Status:** open.
- **Items:**
  1. The negative control pins the measured stub log (adapter 7.0.0 reconnects and lists tools a second time before answering "not found", sending no `tools/call`) and is retitled "A call to a tool the plugin's server does not list is never sent to the server", against the plan's must-have "its log holds only the startup listing".
  2. "(D-CF6-10)" appears in two scenario titles and the feature description, relying on the layout rule that a divergence scenario names its ID.
  3. The no-tools agent scenario keeps a stub server and compares its log, beyond the plan's list, to prove a plugin tool exists but is withheld.
  4. The agent Givens check only the written file's `tools:` lines, not the whole text.
  5. REQUIREMENTS.md was not updated by the executor (MCP-02/MCP-07 left to the orchestrator; MCP-07 is met only as a gap).
- **Recorded in:** `06-04-SUMMARY.md`.

#### P6-DC-13: Plan 06-02 executor choices (server configuration)

- **Phase / source:** Phase 6 executor for `06-02-PLAN.md` (`06-02-SUMMARY.md`).
- **Severity:** Medium (items 2, 4); the rest Low. **Status:** open.
- **Items:**
  1. HTTP request Thens state the POSTs in arrival order and the other requests (the SDK's event-stream `GET`, which arrives within 1 ms of `tools/list`) in any order.
  2. The HTTP listing wait ends at the first logged `tools/list`; a small gap remains before the adapter closes its client (no failure in 15 runs).
  3. A header the request did not carry shows as `(none)`, not the plan's empty cell, so an unset-variable header (`x-team: ""`) is told apart from a dropped one.
  4. The OAuth scenario cannot tell OAuth mode from non-OAuth mode: it pins that an `auth: "oauth"` entry connects, sends the header, and starts no sign-in; only the integration test pins the written field.
  5. Server names `tag` and `root` instead of the plan's `stub`, because 06-01's `withStubServers` reads a lone server named `stub` as a stub marker (parent line).
  6. The environment preload is passed in `args` as a `file://` URL.
  7. The loopback stand-in's answers differ slightly from the frozen stub's (no protocol-version fallback, no `required` in the echo schema) to avoid a fallow clone.
- **Recorded in:** `06-02-SUMMARY.md`.

#### P6-DC-14: Plan 06-06 executor choices (lifecycle)

- **Phase / source:** Phase 6 executor for `06-06-PLAN.md` (`06-06-SUMMARY.md`).
- **Severity:** Medium (item 1); the rest Low. **Status:** open.
- **Items:**
  1. The update scenario's replacement `.mcp.json` uses the wrapper-less root form (`{"stub": {...}}`) because 06-01's `withStubServers` reads a `mcpServers` member as a stub marker; the scenario now also depends on a root `.mcp.json` being read without its wrapper, not checked against Claude Code 2.1.316.
  2. Kept the named `readFile` import, leaving the criterion `grep -c readFile <= 1` unmet as written (one call site).
  3. The override-survives-update scenario changes only the version, not the server definition.
  4. The no-update control compares the stub's whole log, which cannot tell the versions apart; only the model's answer does.
- **Recorded in:** `06-06-SUMMARY.md`.

#### P6-DC-15: Plan 06-05 executor choices (companion missing, project trust)

- **Phase / source:** Phase 6 executor for `06-05-PLAN.md` (`06-05-SUMMARY.md`).
- **Severity:** Medium (item 1); the rest Low. **Status:** open.
- **Items:**
  1. A Phase 6 copy of the calls step, `the model receives these mcp calls:`, reads `{em dash}` as U+2014 so the adapter's blocked reasons can be compared whole despite the `fix-unicode-dashes` hook; two calls steps now differ only in that projection, and the token is not yet in the frozen cucumber skill (parent line).
  2. A polling Given runs `info` every 50 ms (15 s) until pi-mcp-adapter has reported, so the command under test doubles as the wait; a status that never leaves `status unknown` fails in the Given.
- **Recorded in:** `06-05-SUMMARY.md`.

#### P6-DC-16: Plan 06-03 executor choices (server sources merge)

- **Phase / source:** Phase 6 executor for `06-03-PLAN.md` (`06-03-SUMMARY.md`).
- **Severity:** Medium (items 1, 2, 9); the rest Low. **Status:** open.
- **Items:**
  1. An `mcpServers` array with one bad element is refused whole (one note, no element read); upstream refuses the whole manifest, so there is no partial behavior to copy.
  2. A file's server map is read with `Object.hasOwn(document, "mcpServers")`, not upstream's `G.mcpServers || G`; they differ when `mcpServers` is falsy (`null`, `0`, `""`).
  3. A non-object `.mcp.json` document (`5`, `null`) now gets the note `malformed mcpServers: must be object` instead of an incidental "Cannot use 'in' operator" note; both stay `{malformed mcp}`.
  4. A `.mcpb`/`.dxt` source adds no note, so `info` shows only `{unsupported mcp}` without naming the bundle.
  5. An absolute or escaping `.mcpb` path is a fatal `malformed mcp reference` (containment runs first), matching upstream's refusal of such paths.
  6. The no-plugin.json step text names its kind (`... has no plugin.json, so its marketplace entry declares its mcp servers`), differing from the plan's wording.
  7. The comment above the MCPR-01 backstop test in `test/domain/plugin-resolver.test.ts` was edited, just outside the plan's strict `git diff` bound.
  8. `[1]` replaces `[]` in the two refused plugin-schema lists in `test/domain/components/plugin.test.ts`.
  9. The four Task 3 scenarios (entry, bundle, reference rules) have no measured red run; their red is argued from the old code.
- **Recorded in:** `06-03-SUMMARY.md`.

#### P6-DC-17: Plan 06-08 executor choices (compatibility doc)

- **Phase / source:** Phase 6 executor for `06-08-PLAN.md` (`06-08-SUMMARY.md`).
- **Severity:** Medium (items 4, 5, 6); the rest Low. **Status:** open.
- **Items:**
  1. The `MCP_DIRECT_TOOLS` deferred-tool name (`mcp__plugin_demo_stub___echo`, three underscores) is recorded as its own Naming divergence although ADOC-01 covers adapter settings in general.
  2. The hooks paragraph states only the adapter fact (a proxied call is also a nested call under the real name) and leaves whether plugin matchers fire to the Phase 5 reconcile (parent line).
  3. The header names the canary run without its version and points to Further reading, pulling against the must-have to state the old basis.
  4. The Upgrading bullet says a skipped file-source server counts as "no longer declared" for AMIG-01; inferred from `resolveStrict` reuse, not run.
  5. The D-CF6-10 item says Claude Code runs a subagent with a plugin MCP tool in the foreground; follows MCP-07's wording, no 2.1.316 probe.
  6. The Migration divergence item is kept, reworded, although upstream also refuses such a plugin.
  7. Scenario file names are cited in the user-facing doc.
  8. The `--mcp-config` sentence ("Pi still does not run its built-in MCP") rests on an adapter source comment, not a run.
- **Recorded in:** `06-08-SUMMARY.md`.

#### P6-DC-18: Plan 06-07 executor choices (silent skip)

- **Phase / source:** Phase 6 executor for `06-07-PLAN.md` (`06-07-SUMMARY.md`).
- **Severity:** High (items 1, 2); the rest Low. **Status:** open.
- **Items:**
  1. A skipped MCP file source or malformed server gets no user message, only an env-gated `hookDebugLog(..., "mcp")` line; a user loses a bad server silently, as in Claude Code.
  2. EACCES and containment-walk I/O errors (ENOTDIR) are skipped rather than reported as `{permission denied}`, following upstream's loader; a real permission problem now goes unreported.
  3. One Outline state Given (`the mcp file ... is {string}`, states `missing`, `not valid JSON`, `readable by nobody`) replaces the plan's three Givens; the plan's `cannot be read by anyone` step text is not registered.
  4. The Outline's surviving server is inline in every row, so ".mcp.json survives a bad reference" is pinned by unit tests only.
  5. The 7 named plugin-resolver tests keep their arrange and now expect installable with no servers, instead of gaining a second source.
- **Recorded in:** `06-07-SUMMARY.md`.

#### P6-DC-19: Plan 06-09 executor choices (phase gate and records)

- **Phase / source:** Phase 6 executor for `06-09-PLAN.md` (`06-09-SUMMARY.md`).
- **Severity:** Medium (items 2, 9); the rest Low. **Status:** open.
- **Items:**
  1. The doc check edited `docs/mcp-compatibility.md`, outside the plan's `files_modified`, as Task 1's action directs.
  2. The new doc sentence "a skipped server does not replace an earlier one" rests on code, unit tests, and the research's reading of upstream; no scenario or 2.1.316 probe checks it.
  3. The Upgrading bullet still covers only a malformed server, not a whole skipped file (no test runs that case).
  4. The canary parent line is "re-run live on 7.0.0" rather than "raise to 7.0.0", since Phase 1 already pinned `ADAPTER_VERSION = "7.0.0"`.
  5. A first gate run was stopped after 2 minutes and restarted whole after a docs-only fix; none of its output is used.
  6. The Outcome column of the drafted Key Decisions rows: "✓ Good" for ten, "⚠ Revisit (gap pinned; report not filed)" for D-CF6-10.
  7. The pi-subagents gap report ranks its requests; its reproduction steps were not run outside the harness.
  8. The CHANGELOG draft has five sub-bullets and omits the re-measured doc and the agent gap.
  9. The drafted MCP-07 line is checked `[x]` with "gap-pinned (D-CF6-10)", which could be read as a working foreground call.
  10. The four drafted BACKLOG IDs (MCPBG-01, MCPSUB-01, MCPB-01, MCPREF-01) were chosen by the executor.
  11. The `@public` tag clean-up and the `collision-*.ts` comment fixes stay parent lines although Phase 6 owns those files.
  12. The SUMMARY was committed in three commits (one per task).
- **Recorded in:** `06-09-SUMMARY.md`.

#### P6-DC-20: Verification-step choices (validation and security audit)

- **Phase / source:** Phase 6 verify:post steps (`06-VALIDATION.md`, `06-SECURITY.md`), orchestrator and gsd-security-auditor.
- **Severity:** Low. **Status:** open.
- **Items:**
  1. The Nyquist audit found no gap and spawned no auditor: every MCP requirement maps to a committed feature file that passed in the phase gate's three cucumber runs; the user gate ("Fix all gaps" / "mark manual-only") was not shown because nothing was missing.
  2. T-06-SC (named in all nine plans) is one register row.
  3. The six `accept` threats were closed by writing their Accepted Risks Log rows (AR-06-01..06), with "plan threat model (Phase 6 planner)" as the accepter rather than the user.
  4. The no-read proof for T-06-07/T-06-16 rests on the unit cases; the outside-reference scenario proves only the fatal refusal.
  5. T-06-14 was checked at L1 depth (the three lifecycle scenarios); the D-08-02 field carry-over was not traced.
  6. The root `.mcp.json` is read through symlink-following `stat`/`readFile` without containment (predates Phase 6); recorded as an observation, not a threat.
- **Recorded in:** `06-VALIDATION.md`, `06-SECURITY.md`.

#### P6-DC-21: Code review fix choices

- **Phase / source:** Phase 6 code review (`06-REVIEW.md`, 0 critical, 8 warnings, 8 info) and gsd-code-fixer (`06-REVIEW-FIX.md`).
- **Severity:** Medium (items 1, 2); the rest Low. **Status:** open.
- **Items:**
  1. WR-03: the MCP file-source skip now skips any Error carrying a Node `code` (EMFILE and EIO included, as upstream's loader skips every `readFile` failure) and rethrows errors without a code and non-Error values; a pre-Phase-6 plugin-resolver test was restored to its "propagates" form. The rethrow in `locateReference` has no dedicated test.
  2. WR-01/WR-02: no resolver change. A probe of Claude Code 2.1.316 shows upstream reads `.mcp.json` and named server files through symlinks wherever they point; the root file already matches, and the refusal of every symlinked reference (MCPR-04, D-14) is now a documented divergence. Whether to follow in-root links is left as a parent line for the user. Evidence covers a directory marketplace and `file://` url plugins only.
  3. WR-04: the reconcile move's "no longer declares it." wording for a skipped malformed server is kept (product code Phase 6 does not own) with a test comment and a parent line.
  4. WR-05: the WLIF-01 test was retitled to what it proves instead of adding a mock; an existing case already reaches the branch.
  5. WR-06: a bad POST to the HTTP stand-in is answered 400 and logged but does not fail the release; an append or answer failure does.
  6. The orchestrator scoped the fix to warnings plus IN-06 and wrote `06-REVIEW-DISPOSITION.md` by hand (the other info items `deferred`) instead of running the disposition script.
- **Recorded in:** `06-REVIEW-FIX.md`, `06-REVIEW-DISPOSITION.md`.

#### P6-DC-22: Phase 6 stops at human verification, not transitioned

- **Phase / source:** Phase 6 verifier (`06-VERIFICATION.md`, status `human_needed`, 4/5 success criteria verified).
- **Severity:** High. **Status:** open.
- **Choice:** The orchestrator persisted the one human item as `06-UAT.md` and did not run the phase transition (`phase.complete`, ROADMAP/STATE/REQUIREMENTS marks). The item is whether the D-CF6-10 gap pin (pi-subagents 0.84.0 refuses a foreground agent's plugin MCP tool; the refusal is pinned whole) satisfies MCP-07 and ROADMAP success criterion 4, whose literal wording asks for a working agent call. D-CF6-10 was settled autonomously, so recording an override with an `accepted_by` name would claim a user acceptance that does not exist.
- **Alternatives:** Treat the user's standing "make decisions as you see fit" instruction as acceptance and write the override, then transition; or open a gap plan for a working agent call (needs a harness whose background children load the companions and the scripted model, BACKLOG MCPBG-01, and a pi-subagents change).
- **Why dubious:** The brief asks the child to carry the phase through the transition; stopping leaves the parent one decision to make before merging. Every other success criterion passes.
- **Recorded in:** `06-UAT.md`, `06-VERIFICATION.md`.

Source: `.planning/phases/06-mcp-servers/DUBIOUS-CHOICES.md`.

### Phase 7 (Workflows): Dubious Choices Log

Phase 7's share of the component-features review queue. Same shape as the root
`.planning/DUBIOUS-CHOICES.md`; the parent folds these entries into it at
merge. Only the Phase 7 orchestrator session writes this file; subagents report
theirs under `## Dubious Choices` and the orchestrator copies them here.


#### P7-DC-01: Phase 7 discuss decisions settled without the user

- **Phase / source:** Phase 7 smart discuss (`07-CONTEXT.md`).
- **Severity:** Medium. **Status:** open.
- **Choice:** FG-31 and FG-32, and the Phase 7 grey areas (refusal coverage,
  companion-missing recovery, lifecycle), were settled from upstream evidence
  and the engine 3.15.0 source, per the user's standing instruction and
  `CHILD-SESSION-BRIEF.md`.
- **Alternatives:** Ask the user, as the smart-discuss workflow would.
- **Why dubious:** The workflow presents each grey area for acceptance.
- **Recorded in:** `07-CONTEXT.md`.

#### P7-DC-02: The engine's `{_, _raw, key=value}` argument shape is pinned (FG-32)

- **Phase / source:** Phase 7 discuss (D-CF7-02).
- **Severity:** Medium. **Status:** open.
- **Choice:** Accept the engine's slash-path shape and pin it in a scenario;
  record it as engine-owned behavior with an ID, not as a divergence.
- **Alternatives:** Pass the typed text as one string (upstream's Workflow tool
  passes `args` verbatim, so a string is the closest literal reading); or parse
  JSON typed after the command into a structured value.
- **Why dubious:** Upstream states no rule for text typed after
  `/<plugin>:<name>` (MEDIUM confidence; the 2.1.316 binary documents only the
  tool's `args` input). A script written for upstream that reads `args` as a
  string or as an array breaks here. Changing the shape would need an engine
  change, outside this project.
- **Upstream evidence:** 2.1.316 binary prose "args: any -- the value passed as
  Workflow's `args` input, verbatim"; engine 3.15.0
  `src/saved-commands.ts::parseCommandArgs`.
- **Recorded in:** `07-CONTEXT.md` D-CF7-02; `docs/workflows-compatibility.md`
  (wave 3).

#### P7-DC-03: No run approval recorded as a Pi gap (FG-31)

- **Phase / source:** Phase 7 discuss (D-CF7-01).
- **Severity:** High. **Status:** open.
- **Choice:** Record the missing run approval as a Pi-gap divergence; the
  bridge adds no approval of its own.
- **Alternatives:** A bridge-side confirmation before the engine runs (needs a
  hook on the engine's command handler that the engine does not offer;
  wrapping the engine's command would mean the bridge registers commands the
  engine owns).
- **Why dubious:** Upstream asks before a plugin workflow runs in manual mode;
  here third-party code runs on a slash command with no prompt. It is a
  security-relevant difference, though the user already typed the command.
- **Recorded in:** `07-CONTEXT.md` D-CF7-01.

#### P7-DC-04: Install-time refusal of nondeterministic and unparseable scripts kept (D-CF7-03)

- **Phase / source:** Phase 7 discuss (D-CF7-03).
- **Severity:** Medium. **Status:** open.
- **Choice:** Keep refusing these scripts at install and give the timing
  difference an ID, rather than admitting them and letting the engine refuse
  them at run as upstream's loader effectively does.
- **Alternatives:** Admit them with a caveat (as the six warned checks are),
  which matches upstream's timing.
- **Why dubious:** It is a divergence the project rules license only with a
  recorded decision; the doc recorded it without an ID until now.
- **Recorded in:** `07-CONTEXT.md` D-CF7-03.

#### P7-DC-05: Commit trailer names this child session, not the parent

- **Phase / source:** Phase 7 session setup.
- **Severity:** Low. **Status:** open.
- **Choice:** Commits end with this session's `Claude-Session` link
  (`session_01EDUMG6U1zk7CfbwevqpZYJ`), which the session's own attribution
  settings give, instead of the parent's link that `CHILD-SESSION-BRIEF.md`
  quotes.
- **Alternatives:** Copy the brief's line verbatim.
- **Why dubious:** The brief says "exactly". The child's link is the one that
  leads to the transcript that made the commit.
- **Recorded in:** this file only.

#### P7-DC-06: Phase 7 research choices (accepted by the orchestrator)

- **Phase / source:** Phase 7 research (`07-RESEARCH.md`); CONTEXT revised to match.
- **Severity:** Medium. **Status:** open.
- **Choices:**
  1. **Engine-later recovery uses a settings `packages` entry plus a new
     session, not a literal `/reload`.** Over RPC `/reload` goes to the model,
     and a scenario can start only one profile Pi. A new session re-reads Pi's
     settings as `/reload` does; verified live. Alternatives: drive `/reload`
     through the TUI driver, or edit frozen `world.ts` for a second profile Pi.
     Dubious because the session starts with reason `new`, not `reload`.
  2. **D-CF7-02 is now a divergence (supersedes P7-DC-02's "no upstream
     position").** The 2.1.316 binary makes a plugin workflow command a prompt
     command that tells the model `Workflow({ name, args: "<typed text>" })`,
     so upstream `args` is one string; the engine passes an object. Kept,
     licensed as a Pi-side gap (the engine owns the slash handler).
  3. **D-CF7-04 reworded:** Claude Code skips scripts whose `meta` is not
     first, has a reserved key, or lacks a description at load; the bridge
     admits them with a warning and the engine refuses them at run. Kept
     (WGATE decisions); switching to per-file skips would break tests outside
     this phase.
  4. **The install warning "the engine will refuse to load it" stays pinned**
     although the engine registers the command and refuses only at run; tests
     and the output catalog outside this phase pin it. Backlog parent line.
  5. **The listing `Then` picks bridged commands by the engine path plus a `:`
     in the name,** not by a hard-coded list of the engine's own commands.
  6. **Engine notices are compared after converting U+2014 to `--`,** because
     the commit hook rewrites em dashes outside `.planning/` and the hook
     config is not Phase 7's.
  7. **The refusal-fixture install is read with a `When`** (an info cascade
     plus a warning diagnostic), replacing CONTEXT's implied "the install
     shows a warning".
- **Recorded in:** `07-RESEARCH.md`, `07-CONTEXT.md`.

#### P7-DC-07: Phase 7 pattern-map choices

- **Phase / source:** Phase 7 pattern map (`07-PATTERNS.md`).
- **Severity:** Low. **Status:** open.
- **Choices:**
  1. **Shared record-reading helpers live in `features/lib/workflow-files.ts`**
     (documented as the fixture writer), because it is the only lib file
     Phase 7 may edit (`layout.md` freezes the others). Alternative: a new
     `features/lib/workflow-runs.ts`.
  2. **The shared topic module keeps the name `listing.steps.ts`,** close to a
     verb name, following the skill and slash-command precedent.
  3. **The notices step names its kind** (`the workflow engine shows these
     notices:`) instead of RESEARCH's `pi shows these notices:`, per
     `layout.md`'s rule that a new step names its kind.
- **Recorded in:** `07-PATTERNS.md`.

#### P7-DC-08: Phase 7 planning choices

- **Phase / source:** Phase 7 planner (`07-01..07-06-PLAN.md`).
- **Severity:** Medium. **Status:** open.
- **Choices:**
  1. Wave 1 also creates `features/workflow/lifecycle.feature` with one
     scenario (the stale notice after uninstall), so the no-run `When` and the
     notices `Then` that 07-02 and 07-05 share are used in wave 1 and
     `check:features` stays green in every wave-2 worktree.
  2. `runs.steps.ts` keeps the three seed run steps; only the four new shared
     steps go to `listing.steps.ts` (Phase 2 instead moved every shared step to
     `listing.steps.ts`).
  3. 07-03 rewrites the `run.feature` description to name D-CF7-01 and keeps
     the seed scenario byte-identical.
  4. `sendWorkflowCommand` in `features/lib/workflow-files.ts` imports
     `promptDisposition` from `test/e2e/_rpc.ts`, using `layout.md`'s exception
     for a driver that reuses a process harness.
  5. T-07-07 (no run approval) is rated medium with disposition `transfer`,
     not high: the user consented at install and typed the command, and the
     missing hook belongs to the engine and Pi. P7-DC-03 still rates the
     decision High for review.
  6. 07-03's negative control is a script that throws, with a new failed-run
     `Then`.
  7. 07-02's caveat-run Outline puts each script on one line in an `Examples:`
     cell substituted into a doc string.
  8. The fixture `nope.js` ends with an unreachable `return "never";` to honor
     "every fixture script ends in a return".
  9. 07-04 runs its install-rows and list scenarios on the shared Pi, with no
     profile Pi.
  10. The listing `Then` compares the registry snapshot's command `path` with
      `resolveCompanion(...).entry`, which assumes each worktree runs
      `node scripts/install-test-peers.mjs`.
- **Recorded in:** `07-01..07-06-PLAN.md`.

#### P7-DC-09: Wave 1 executor choices (listing tracer)

- **Phase / source:** Phase 7 wave 1 executor (`07-01-SUMMARY.md`).
- **Severity:** Low. **Status:** open.
- **Choices:**
  1. `requirements-completed` lists only WFL-01, not WFL-05: this plan
     delivers only the WLIF-06 stale notice after uninstall, and 07-05
     finishes WFL-05.
  2. The listing filter keeps only commands whose name holds a colon
     (research assumption A3). A future engine built-in with a colon, or a
     bridged command that lost its `<plugin>:` prefix, would still fail the
     whole-table comparison rather than pass silently.
  3. The WNAM-06 (prefix elision) scenario title does not name the ID, because
     the feature rules forbid ticket references in titles; the ID is in the
     commit and the SUMMARY only.
- **Process note:** the Write tool saved a raw U+2014 where the `—`
  escape was meant, and the `fix-unicode-dashes` hook turned the constant
  into `"--"`; the executor caught it and rewrote the escape byte-exactly.
  Later executors are warned.
- **Recorded in:** `07-01-SUMMARY.md`.

#### P7-DC-10: Wave 2 executor choices (refusals)

- **Phase / source:** Phase 7 wave 2, refusals executor (`07-02-SUMMARY.md`).
- **Severity:** Low. **Status:** open.
- **Choices:**
  1. The setup `Given` (`..., which reported notes on workflow scripts of the
     plugin`) checks the shape only (an info cascade, then a warning diagnostic
     whose lines all start with `workflow script "`); a zero-line diagnostic
     would pass it. The one-script installs are pinned whole only in the
     install scenarios.
  2. `late.js` puts `const greeting = "late";` directly above the `meta` line;
     the other fixtures follow the plan's `meta`, blank line, `return` form.
  3. One `check:static` run lost its lint job to out-of-memory beside a warm-up
     ESLint; a lone `npm run lint` and a later full `check:static` passed.
  4. The SUMMARY's commit count was measured before the SUMMARY commit.
- **Parent line (BACKLOG):** the caveat text "was installed but the engine will
  refuse to load it" in `bridges/workflows/discover.ts` is inaccurate (the
  engine registers the command and refuses at run); rewording touches three
  unit tests, `docs/output-catalog.md`, and `refusals.feature`.
- **Recorded in:** `07-02-SUMMARY.md`.

#### P7-DC-11: Wave 2 executor choices (lifecycle)

- **Phase / source:** Phase 7 wave 2, lifecycle executor (`07-05-SUMMARY.md`).
- **Severity:** Low. **Status:** open.
- **Choices:**
  1. The worktree isolation guard refused a write of the plan-ledger file
     under `.git/worktrees/...`; the plan base was recorded in the executor's
     scratch folder instead, and the SUMMARY's commit count excludes the
     SUMMARY commit.
  2. The plan duration in the SUMMARY is estimated (no start time captured).
  3. Plan 07-01's stale-notice scenario keeps its title and steps; only its
     setup moved into the new `Background:`.
- **Recorded in:** `07-05-SUMMARY.md`.

#### P7-DC-12: Wave 2 executor choices (argument runs)

- **Phase / source:** Phase 7 wave 2, runs executor (`07-03-SUMMARY.md`).
- **Severity:** Low. **Status:** open.
- **Choices:**
  1. `run.feature`'s description names the no-approval gap in words ("a Pi
     gap") without the ID D-CF7-01, since no feature file in the suite cites
     decision IDs; the SUMMARY maps the wording to D-CF7-01 and D-CF7-02.
  2. The three-line description dropped "ends with the value the script
     returns" (the seed title still states it); its third line is about 92
     characters.
  3. `nope.js` keeps an unreachable `return "never";` after its `throw` so
     every fixture body ends in a `return`.
- **Recorded in:** `07-03-SUMMARY.md`.

#### P7-DC-13: Wave 2 executor choices (engine missing)

- **Phase / source:** Phase 7 wave 2, companion-missing executor (`07-04-SUMMARY.md`).
- **Severity:** Medium. **Status:** open.
- **Choices:**
  1. **Merge into Pi's user settings instead of a `wx` write.** Every profile
     Pi already has `<agentDir>/settings.json` (`{"retry":{"enabled":false}}`,
     saved when the frozen `usePiWithProfile` sends `set_auto_retry`), which
     research's probe never sent. The step refuses a file that already has a
     `packages` member, adds `packages: [<engine root>]` beside the other
     members as `pi install` does, and restores the exact text it found (or
     removes the file) at release. Alternative: project settings
     (`<project>/.pi/settings.json`), unverified and entangled with project
     trust (HAR-06). Threat T-07-09 now rests on merge-and-restore.
  2. No `Background:` in `companion-missing.feature`: two scenarios start a
     profile Pi first, and the wave-1 features repeat their setup per scenario.
  3. The marker scenarios run on the shared Pi and rely on every settings edit
     being restored at release.
- **Recorded in:** `07-04-SUMMARY.md`.

#### P7-DC-14: Wave 3 executor choices (docs and gate)

- **Phase / source:** Phase 7 wave 3 executor (`07-06-SUMMARY.md`).
- **Severity:** Low. **Status:** open.
- **Choices:**
  1. A new evidence grade, `scenario-measured at 3.15.0`, in
     `docs/workflows-compatibility.md` for claims a `features/workflow/`
     scenario measures.
  2. The `export let/var` and second-declarator rows were read from the
     2.1.316 binary offline (skipped at load upstream) rather than marked
     `not read`.
  3. The `args` row's Pi cell changed from `--` to `⚠`, and the old advice to
     call structured scripts through the engine's tool was removed (its
     premise was wrong).
  4. A reserved-key row was added to the admit-versus-run table.
  5. Quotes of engine and Claude Code text use `--` for U+2014 (commit hook).
  6. The CHANGELOG parent line is marked Internal (no product fix).
  7. The SUMMARY's commit count excludes its own final commit.
- **Recorded in:** `07-06-SUMMARY.md`.

#### P7-DC-15: Code review and fix loop choices

- **Phase / source:** Phase 7 code review (`07-REVIEW.md`, `07-REVIEW-FIX.md`), 3 iterations.
- **Severity:** Medium. **Status:** open.
- **Choices:**
  1. **WR-01 pinned in every run scenario:** each run scenario states the
     engine's `info` start notice and its `warning` "delivery ... deferred:
     ... has no thenable send function" (engine 3.15.0 over RPC never posts
     the result back). If a later Pi or engine fixes delivery, six scenarios
     change at once.
  2. New local tokens `{run id}` and `{session id}` in the notices step (not
     in the frozen `run-tokens.ts` or the cucumber skill's token list), and a
     read-only RPC `get_state` inside a `Then` to read the session id (the
     frozen world turn has no field for it). Parent line: list the tokens in
     the skill and keep a turn's session id in the world (IN-06).
  3. The engine-absent negative control checks every command source for a
     name containing the workflow name; a future command containing "hello"
     would need a new fixture name.
  4. WR-03 was fixed by adding coverage (three refusal rows, two lifecycle
     scenarios) rather than narrowing the doc's grades.
  5. The joined diagnostic `lines` column stays next to the new per-line
     table (the frozen results step appends any omitted column; IN-08 parent
     line for `features/lib/field-rows.ts`).
  6. IN-05: only the notices step marks a run turn compared. This follows
     `steps.md` but contradicts the literal `world-and-stand-ins.md:66`
     ("A `Then` that reads the turn marks it compared"); kept as Info IN-10
     with a parent line to fix the skill text.
  7. Fixers worked in the main checkout (no worktree) so the cucumber red
     proofs could run; the review/fix reports were committed per iteration
     (the stop hook requires a clean tree) instead of once at the end, and
     the iteration backups were kept in the scratchpad.
- **Recorded in:** `07-REVIEW.md`, `07-REVIEW-FIX.md`, `07-REVIEW-DISPOSITION.md`.

#### P7-DC-16: Verification choices

- **Phase / source:** Phase 7 verifier (`07-VERIFICATION.md`, status passed 5/5).
- **Severity:** Medium. **Status:** open.
- **Choices:**
  1. WFL-04 passed on the settings `packages` entry plus a new session (with
     a negative control), not a literal `/reload`; a stricter reading would
     mark it uncertain and ask a human.
  2. WFL-03's "reserved names" read as the engine's reserved `meta` keys
     (`__proto__`, `constructor`, `prototype`); `<plugin>:` command names
     cannot collide with Pi's reserved commands.
  3. The verifier re-ran only `features/workflow` and relied on the
     orchestrator's recorded full gate.
- **Recorded in:** `07-VERIFICATION.md`.

#### P7-DC-17: Transition step skipped for PROJECT.md

- **Phase / source:** Phase 7 transition (post-completion mode).
- **Severity:** Low. **Status:** open.
- **Choice:** The transition's `evolve_project` step (validated requirements,
  Key Decisions rows, "Last updated" footer in `.planning/PROJECT.md`) was not
  run in this child session. `CHILD-SESSION-BRIEF.md` forbids editing
  PROJECT.md Key Decisions, and the other edits to that shared 2.6 MB file
  would conflict with the sibling phases' merges. The parent applies the
  D-CF7-01..04 Key Decisions rows from `07-06-SUMMARY.md` "Parent lines" and
  moves WFL-01..05 to Validated at merge. `phase.complete` already updated
  ROADMAP.md, STATE.md, and REQUIREMENTS.md (WFL-01..05 checked).
- **Alternatives:** Edit PROJECT.md's requirement and footer sections here.
- **Recorded in:** this file only.

Source: `.planning/phases/07-workflows/DUBIOUS-CHOICES.md`.

### DC-39: Carrying out the user's 2026-11-02 decisions (db5622a..fceb752, 8aef795, b68d4ad)

Implementation choices made while acting on decisions A.1 to A.3. Each user-visible change has a scenario that failed without it, except where noted.

1. **Command aliases (A.1 item 2, db5622a):** skills claim aliases before commands, so a command alias never takes a name a skill holds; upstream's cross-kind order was not probed, and this is the opposite of D-CF2-03's "command wins" for identities. Refusals name the command's Pi name, not the alias typed. Aliases come from the staged frontmatter at session time, so existing installs get them without a reinstall; map-form commands also get aliases from their file's `name`.
2. **Model reads of a skill (A.1 item 3, dfba92a):** `$N` and `$ARGUMENTS[N]` stay literal and named arguments become empty, as a typed invocation with no arguments. Frontmatter lines stay raw. The rewrite runs after the hooks bridge, so PostToolUse hooks see the raw file. Partial reads map by line offset. Pi's NFD and curly-quote path fallbacks are not mirrored.
3. **`run_plugin_command` tool (A.1 item 4, cd3b5b1):** tool name and `command`/`args` parameters are the agent's choice. The command list lives in the tool description (upstream uses a system-message section); the body comes back as the tool result (upstream returns "Launching skill" plus a user message). Aliases are not accepted as `command`. "Described" is a heuristic: a staged description equal to the body's first-line fallback counts as unset, so an author description identical to that line is hidden. The tool is offered only when at least one command is listed; no system-prompt text changes.
4. **No second expansion (A.1 item 6, b48e1e4):** a finished text starting with `/` gets one U+200B, which reaches the model. The skill scenario passes either way, because a skill's text is Pi's `<skill>` block.
5. **MCP agents (A.2, 204a8e6, fceb752):** an agent that runs plugin MCP tools always gets `async: true`, even with `background: false`, and the new warning also covers agents with no `tools:` line, which added a staging warning to existing update output. A pi-subagents call that passes `"async": false` still forces foreground and still fails.
6. **MCP links (A.3, 8aef795):** the boundary is the plugin root only, even for a plugin read in place from its marketplace (D-PL2-17 would allow the marketplace directory). The realpath is resolved once and the file read through it; the small walk-to-read window matches D-PL2-24. The corrected refusal note reaches only the debug log (users see `{malformed mcp}`), so only a unit test pins its wording. A dangling link or a link loop is skipped silently. Claude Code also follows links that point outside; we still refuse those (MCPR-04 as amended).
7. **Upstream patches:** Pi (`pi-input-transform-expand.patch`) and pi-subagents (`pi-subagents-mcp-direct-tools.patch`) are drafted, authored as `acolomba <acolomba@gmail.com>`, with no changelog edits (Pi forbids contributor changelog edits; pi-subagents credits the PR number). Neither repository's full test gate ran here (sandbox network limits). The Pi patch file in this repo had blank context lines trimmed by the whitespace hook; it still applies, and the exact version is on the local branch of the Pi clone. A Pi fork could not be created from this session (access refused).
8. **Process:** this cloud environment exports `SKIP=trufflehog` (the binary is not installed), so no local commit in this session ran the secret scan. CI's Lint workflow still runs it on a pull request.
