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
